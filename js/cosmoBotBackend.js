/**
 * CosmoBot Backend — Firebase RTDB (Pi trigger), Storage (audio), Firestore (data)
 *
 * RTDB paths (matches Pi listener):
 *   /hardware_trigger  → { action_type, audio_url, processed }
 *   /device/pi0          → { aiBusy, lastSeen }
 *   /tasks               → scheduled lesson pushes
 */
const CosmoBotBackend = (function () {
  const DEFAULT_DEVICE = 'pi0';
  const DEVICE_STALE_MS = 90000;

  let rtdb = null;
  let storage = null;
  let firestore = null;
  let uid = null;
  let deviceUnsub = null;

  function requireReady() {
    if (!rtdb || !storage || !firestore || !uid) {
      throw new Error('CosmoBot backend is not initialized.');
    }
  }

  function init(services, userId) {
    rtdb = services.rtdb;
    storage = services.storage;
    firestore = services.firestore;
    uid = userId;
  }

  function userRef() {
    return firestore.collection('users').doc(uid);
  }

  function classesRef() {
    return userRef().collection('classes');
  }

  function sanitizeName(name) {
    return String(name || 'file')
      .trim()
      .replace(/[^\w.\-()+ ]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  async function uploadFile(file, storagePath) {
    requireReady();
    const ref = storage.ref(storagePath);
    const snap = await ref.put(file);
    return snap.ref.getDownloadURL();
  }

  async function uploadLessonAudio(file, classId, lessonId) {
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const path = 'users/' + uid + '/classes/' + classId + '/lessons/' + lessonId + '.' + ext;
    return uploadFile(file, path);
  }

  async function uploadTimetable(file, classId) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = 'users/' + uid + '/classes/' + classId + '/timetable.' + ext;
    return uploadFile(file, path);
  }

  async function uploadNote(file, classId, noteId) {
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const path = 'users/' + uid + '/classes/' + classId + '/notes/' + noteId + '_' + sanitizeName(file.name);
    return uploadFile(file, path);
  }

  /**
   * Tell the Raspberry Pi to play audio via hardware_trigger.
   * Pi should set processed: true when done.
   */
  async function triggerPlayNow(payload) {
    requireReady();
    const audioUrl = payload && payload.audioUrl;
    if (!audioUrl) {
      throw new Error('This lesson has no uploaded audio yet.');
    }
    if (audioUrl.startsWith('blob:')) {
      throw new Error('Audio is still local. Re-add the lesson with an audio file.');
    }

    await rtdb.ref('hardware_trigger').set({
      action_type: 'PLAY_AUDIO',
      audio_url: audioUrl,
      processed: false,
      title: (payload && payload.title) || '',
      triggered_by: uid,
      triggered_at: new Date().toISOString(),
    });

    await rtdb.ref('tasks').push({
      type: 'play_audio',
      title: (payload && payload.title) || '',
      audio_url: audioUrl,
      status: 'sent',
      user_id: uid,
      created_at: new Date().toISOString(),
    });

    return { success: true };
  }

  function watchDevice(deviceId, callback) {
    requireReady();
    if (deviceUnsub) deviceUnsub();
    const ref = rtdb.ref('device/' + (deviceId || DEFAULT_DEVICE));
    const handler = function (snap) {
      const data = snap.val() || {};
      const lastSeen = data.lastSeen ? new Date(data.lastSeen).getTime() : 0;
      const online = lastSeen > 0 && Date.now() - lastSeen < DEVICE_STALE_MS;
      callback({
        deviceId: deviceId || DEFAULT_DEVICE,
        aiBusy: !!data.aiBusy,
        lastSeen: data.lastSeen || null,
        online: online,
      });
    };
    ref.on('value', handler);
    deviceUnsub = function () { ref.off('value', handler); };
    return deviceUnsub;
  }

  async function linkDevice(deviceId) {
    requireReady();
    await userRef().set({ linked_device: deviceId || DEFAULT_DEVICE }, { merge: true });
    await rtdb.ref('users/' + uid).set({
      linked_device: deviceId || DEFAULT_DEVICE,
      updated_at: new Date().toISOString(),
    });
  }

  // --- Firestore class persistence ---

  async function listClasses() {
    requireReady();
    const snap = await classesRef().orderBy('createdAt').get();
    return snap.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  async function createClass(name) {
    requireReady();
    const doc = {
      name: name.trim(),
      subjects: [],
      timeline: [],
      timetable: null,
      notes: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await classesRef().add(doc);
    return Object.assign({ id: ref.id }, doc);
  }

  async function updateClass(classId, data) {
    requireReady();
    await classesRef().doc(classId).set(
      Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }),
      { merge: true }
    );
  }

  async function deleteClass(classId) {
    requireReady();
    await classesRef().doc(classId).delete();
  }

  async function addLesson(classId, lesson) {
    requireReady();
    const classSnap = await classesRef().doc(classId).get();
    if (!classSnap.exists) throw new Error('Class not found.');
    const data = classSnap.data();
    const subjects = data.subjects || [];
    const subject = subjects.find(function (s) { return s.id === lesson.subjectId; });
    if (!subject) throw new Error('Subject not found.');
    const chapter = (subject.chapters || []).find(function (c) { return c.id === lesson.chapterId; });
    if (!chapter) throw new Error('Chapter not found.');

    const lessonRecord = {
      id: lesson.id || 'lesson_' + Date.now(),
      title: lesson.title,
      time: lesson.time,
      length: Number(lesson.length),
      audioUrl: lesson.audioUrl || '',
      subjectName: subject.name,
      createdAt: new Date().toISOString(),
    };
    chapter.lessons = chapter.lessons || [];
    chapter.lessons.push(lessonRecord);

    const timeline = data.timeline || [];
    timeline.push({
      time: lesson.time,
      title: lesson.title,
      length: lesson.length,
      subjectName: subject.name,
      lessonId: lessonRecord.id,
    });
    timeline.sort(function (a, b) { return a.time.localeCompare(b.time); });

    await updateClass(classId, { subjects: subjects, timeline: timeline });
    return lessonRecord;
  }

  async function addSubject(classId, subjectName, chapterName) {
    requireReady();
    const classSnap = await classesRef().doc(classId).get();
    const data = classSnap.exists ? classSnap.data() : { subjects: [] };
    const subjects = data.subjects || [];
    subjects.push({
      id: 'sub_' + Date.now(),
      name: subjectName.trim(),
      chapters: [{
        id: 'ch_' + Date.now(),
        name: chapterName.trim(),
        lessons: [],
      }],
    });
    await updateClass(classId, { subjects: subjects });
    return subjects;
  }

  async function setTimetable(classId, timetable) {
    await updateClass(classId, { timetable: timetable });
  }

  async function addNote(classId, note) {
    requireReady();
    const classSnap = await classesRef().doc(classId).get();
    const data = classSnap.data();
    const notes = data.notes || [];
    notes.push(note);
    await updateClass(classId, { notes: notes });
  }

  window.cosmoBotPlayNow = async function (payload) {
    return triggerPlayNow(payload);
  };

  return {
    init: init,
    uploadLessonAudio: uploadLessonAudio,
    uploadTimetable: uploadTimetable,
    uploadNote: uploadNote,
    triggerPlayNow: triggerPlayNow,
    watchDevice: watchDevice,
    linkDevice: linkDevice,
    listClasses: listClasses,
    createClass: createClass,
    updateClass: updateClass,
    deleteClass: deleteClass,
    addSubject: addSubject,
    addLesson: addLesson,
    setTimetable: setTimetable,
    addNote: addNote,
    DEFAULT_DEVICE: DEFAULT_DEVICE,
  };
})();
