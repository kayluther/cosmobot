/**
 * CosmoBot Learning Studio — dashboard UI wired to Firebase backend.
 */
(function () {
  let currentUser = null;
  let currentClassId = null;
  let currentClassData = null;
  let classesCache = [];
  let activeChapter = null;
  let toastId = null;
  let pondInstances = [];

  const els = {};

  function $(id) { return document.getElementById(id); }

  function say(text) {
    els.toast.textContent = text;
    els.toast.classList.add('show');
    clearTimeout(toastId);
    toastId = setTimeout(function () { els.toast.classList.remove('show'); }, 2800);
  }

  function closeModals() {
    document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('open'); });
  }

  function formatTime(timeStr) {
    const date = new Date('1970-01-01T' + timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase() || 'CB';
  }

  function bindUpload(input, handler) {
    if (window.FilePond) {
      const pond = FilePond.create(input, {
        allowMultiple: input.multiple,
        labelIdle: 'Drag & drop or <span class="filepond--label-action">browse</span>',
        credits: false,
        onaddfile: function (error, item) { if (!error) handler(item.file); },
      });
      pondInstances.push(pond);
    } else {
      input.addEventListener('change', function (e) {
        Array.from(e.target.files).forEach(handler);
      });
    }
  }

  function renderClassList() {
    if (!classesCache.length) {
      els.classes.innerHTML = '<div class="empty" id="classEmpty"><i data-lucide="graduation-cap" width="16"></i>No classes yet. Add your first class.</div>';
      els.selectedClass.textContent = 'No class selected';
      els.classStatus.textContent = 'Add a class to begin.';
      els.deleteClass.disabled = true;
      lucide.createIcons();
      return;
    }

    els.classes.innerHTML = classesCache.map(function (cls) {
      const active = cls.id === currentClassId ? ' active' : '';
      return '<button type="button" class="class-option' + active + '" data-class-id="' + cls.id + '" aria-pressed="' + (cls.id === currentClassId) + '"><span><b>' + cls.name + '</b><br><span>Learning plan</span></span></button>';
    }).join('');

    lucide.createIcons();
  }

  function renderSubjects(subjects) {
    if (!subjects || !subjects.length) {
      els.subjectList.innerHTML = '<div class="empty"><i data-lucide="sparkles" width="16"></i>Your syllabus will appear here.</div>';
      els.syllabusLabel.textContent = 'No subjects added yet';
      return;
    }

    els.subjectList.innerHTML = subjects.map(function (subject) {
      const chapters = (subject.chapters || []).map(function (chapter) {
        const lessons = chapter.lessons || [];
        const lessonLine = lessons.length
          ? lessons.map(function (l) { return '<i>●</i> ' + l.title + ' · ' + l.length + ' min'; }).join('<br>')
          : 'No lessons yet';
        const playBtns = lessons.map(function (l) {
          return '<button type="button" class="play-now" data-title="' + l.title + '" data-audio-url="' + (l.audioUrl || '') + '"><i data-lucide="play" width="12"></i> Play now</button>';
        }).join('');
        return '<div class="chapter" data-subject-id="' + subject.id + '" data-chapter-id="' + chapter.id + '">' +
          '<div class="chapter-row"><b>' + chapter.name + '</b><span>' + lessons.length + ' lesson' + (lessons.length === 1 ? '' : 's') + '</span></div>' +
          '<div class="lesson-line">' + lessonLine + '</div>' +
          (playBtns ? '<div class="lesson-actions">' + playBtns + '</div>' : '') +
          '<button type="button" class="add-lesson"><i data-lucide="plus" width="12"></i> Add lesson</button></div>';
      }).join('');
      const chapterCount = (subject.chapters || []).length;
      return '<div class="subject" data-subject-id="' + subject.id + '">' +
        '<div class="subject-summary"><div class="subject-icon"><i data-lucide="book-open" width="15"></i></div>' +
        '<div><b>' + subject.name + '</b><small>' + chapterCount + ' chapter' + (chapterCount === 1 ? '' : 's') + '</small></div></div>' +
        '<div class="chapters">' + chapters + '</div></div>';
    }).join('');

    els.syllabusLabel.textContent = subjects.length + ' subject' + (subjects.length === 1 ? '' : 's') + ' added';
    lucide.createIcons();
  }

  function renderTimeline(timeline) {
    if (!timeline || !timeline.length) {
      els.timeline.innerHTML = '<div class="empty"><i data-lucide="calendar-plus" width="16"></i>Add a lesson, then give it a time.</div>';
      return;
    }
    els.timeline.innerHTML = timeline.map(function (item) {
      return '<div class="timeline-grid"><div class="time">' + formatTime(item.time) + '</div>' +
        '<div class="slot"><b>' + item.title + '</b><span>' + item.length + ' minutes · ' + item.subjectName + '</span></div></div>';
    }).join('');
  }

  function renderTimetable(timetable) {
    els.timetableFiles.innerHTML = '';
    els.timetablePreview.innerHTML = '';
    els.timetablePreview.classList.remove('show');
    if (!timetable || !timetable.url) return;

    els.timetableFiles.innerHTML = '<div class="file-row"><i data-lucide="calendar-days" width="15"></i><div><b>' + timetable.name + '</b><span>Timetable stored in Firebase</span></div><a href="' + timetable.url + '" target="_blank" rel="noopener">Open</a></div>';

    if (timetable.type && timetable.type.startsWith('image/')) {
      els.timetablePreview.innerHTML = '<img src="' + timetable.url + '" alt="Timetable" />';
      els.timetablePreview.classList.add('show');
    } else if (timetable.type === 'application/pdf') {
      els.timetablePreview.innerHTML = '<iframe src="' + timetable.url + '" title="Timetable PDF"></iframe>';
      els.timetablePreview.classList.add('show');
    }
    lucide.createIcons();
  }

  function renderNotes(notes) {
    if (!notes || !notes.length) {
      els.notesGrid.innerHTML = '<div class="empty"><i data-lucide="file-text" width="16"></i>No notes uploaded yet.</div>';
      return;
    }
    els.notesGrid.innerHTML = notes.map(function (note) {
      return '<div class="note-card"><i data-lucide="file-text" width="16"></i><div><b>' + note.name + '</b><span>PDF note · child can open online</span></div><a href="' + note.url + '" target="_blank" rel="noopener">Open</a></div>';
    }).join('');
    lucide.createIcons();
  }

  function renderWorkspace(cls) {
    currentClassData = cls;
    renderSubjects(cls.subjects || []);
    renderTimeline(cls.timeline || []);
    renderTimetable(cls.timetable || null);
    renderNotes(cls.notes || []);
    els.selectedClass.textContent = cls.name;
    els.classStatus.textContent = 'Synced with Firebase · lessons play on CosmoBot.';
    els.deleteClass.disabled = false;
    pondInstances.forEach(function (p) { p.removeFiles(); });
  }

  async function selectClass(classId) {
    const cls = classesCache.find(function (c) { return c.id === classId; });
    if (!cls) return;
    currentClassId = classId;
    renderClassList();
    renderWorkspace(cls);
    say(cls.name + ' selected');
  }

  async function loadClasses() {
    classesCache = await CosmoBotBackend.listClasses();
    renderClassList();
    if (classesCache.length && !currentClassId) {
      await selectClass(classesCache[0].id);
    } else if (currentClassId) {
      const cls = classesCache.find(function (c) { return c.id === currentClassId; });
      if (cls) renderWorkspace(cls);
    }
  }

  function updateDeviceStatus(status) {
    const dot = els.deviceDot;
    const label = els.deviceLabel;
    if (!dot || !label) return;
    if (status.online) {
      dot.style.background = status.aiBusy ? 'var(--violet)' : 'var(--lime)';
      dot.style.boxShadow = status.aiBusy ? '0 0 10px var(--violet)' : '0 0 10px var(--lime)';
      label.textContent = status.aiBusy ? 'CosmoBot · playing' : 'CosmoBot · online';
    } else {
      dot.style.background = 'var(--pink)';
      dot.style.boxShadow = '0 0 10px var(--pink)';
      label.textContent = 'CosmoBot · offline';
    }
  }

  async function handlePlayNow(btn) {
    const title = btn.dataset.title;
    const audioUrl = btn.dataset.audioUrl;
    btn.disabled = true;
    try {
      await CosmoBotBackend.triggerPlayNow({ title: title, audioUrl: audioUrl });
      say('Sent to CosmoBot: ' + title);
    } catch (err) {
      say(err.message || 'Could not send to CosmoBot.');
    } finally {
      btn.disabled = false;
    }
  }

  async function handleAddTimetable(file) {
    if (!currentClassId) { say('Select a class first.'); return; }
    say('Uploading timetable…');
    try {
      const url = await CosmoBotBackend.uploadTimetable(file, currentClassId);
      const timetable = { name: file.name, url: url, type: file.type };
      await CosmoBotBackend.setTimetable(currentClassId, timetable);
      const cls = classesCache.find(function (c) { return c.id === currentClassId; });
      if (cls) { cls.timetable = timetable; renderTimetable(timetable); }
      say('Timetable saved to Firebase');
    } catch (err) {
      say('Timetable upload failed.');
    }
  }

  async function handleAddNote(file) {
    if (!currentClassId) { say('Select a class first.'); return; }
    say('Uploading note…');
    try {
      const noteId = 'note_' + Date.now();
      const url = await CosmoBotBackend.uploadNote(file, currentClassId, noteId);
      const note = { id: noteId, name: file.name, url: url };
      await CosmoBotBackend.addNote(currentClassId, note);
      const cls = classesCache.find(function (c) { return c.id === currentClassId; });
      if (cls) {
        cls.notes = cls.notes || [];
        cls.notes.push(note);
        renderNotes(cls.notes);
      }
      say(file.name + ' saved to Firebase');
    } catch (err) {
      say('Note upload failed.');
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      const open = e.target.closest('[data-open]');
      if (open) $(open.dataset.open).classList.add('open');
      if (e.target.closest('[data-close]')) closeModals();
      if (e.target.classList.contains('modal')) closeModals();

      const add = e.target.closest('.add-lesson');
      if (add) {
        activeChapter = add.closest('.chapter');
        $('lessonModal').classList.add('open');
      }

      const play = e.target.closest('.play-now');
      if (play) handlePlayNow(play);

      const classBtn = e.target.closest('.class-option');
      if (classBtn && classBtn.dataset.classId) selectClass(classBtn.dataset.classId);
    });

    $('classForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = $('className').value.trim();
      if (!name) return;
      try {
        const created = await CosmoBotBackend.createClass(name);
        classesCache.push(created);
        closeModals();
        e.target.reset();
        await selectClass(created.id);
        say(name + ' added and selected');
      } catch (err) {
        say('Could not create class.');
      }
    });

    $('deleteClass').addEventListener('click', async function () {
      if (!currentClassId) return;
      const cls = classesCache.find(function (c) { return c.id === currentClassId; });
      if (!cls) return;
      if (!window.confirm('Delete ' + cls.name + '? This removes it from Firebase.')) return;
      try {
        await CosmoBotBackend.deleteClass(currentClassId);
        classesCache = classesCache.filter(function (c) { return c.id !== currentClassId; });
        currentClassId = null;
        currentClassData = null;
        await loadClasses();
        say(cls.name + ' deleted');
      } catch (err) {
        say('Could not delete class.');
      }
    });

    $('subjectForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!currentClassId) { say('Select a class first.'); return; }
      const name = $('subjectName').value.trim();
      const chapter = $('firstChapter').value.trim();
      try {
        const subjects = await CosmoBotBackend.addSubject(currentClassId, name, chapter);
        const cls = classesCache.find(function (c) { return c.id === currentClassId; });
        if (cls) { cls.subjects = subjects; renderSubjects(subjects); }
        closeModals();
        e.target.reset();
        say(name + ' is ready for lessons');
      } catch (err) {
        say('Could not add subject.');
      }
    });

    $('lessonForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!currentClassId || !activeChapter) return;

      const title = $('lessonName').value.trim();
      const time = $('lessonTime').value;
      const length = $('lessonLength').value;
      const file = $('lessonFile').files[0];
      const subjectId = activeChapter.dataset.subjectId;
      const chapterId = activeChapter.dataset.chapterId;
      const lessonId = 'lesson_' + Date.now();
      const submitBtn = e.target.querySelector('.button.primary');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading…';

      try {
        let audioUrl = '';
        if (file) {
          say('Uploading audio to Firebase…');
          audioUrl = await CosmoBotBackend.uploadLessonAudio(file, currentClassId, lessonId);
        }

        const lesson = await CosmoBotBackend.addLesson(currentClassId, {
          id: lessonId,
          subjectId: subjectId,
          chapterId: chapterId,
          title: title,
          time: time,
          length: length,
          audioUrl: audioUrl,
        });

        const cls = classesCache.find(function (c) { return c.id === currentClassId; });
        if (cls) {
          const fresh = await CosmoBotBackend.listClasses();
          const updated = fresh.find(function (c) { return c.id === currentClassId; });
          if (updated) {
            Object.assign(cls, updated);
            renderWorkspace(cls);
          }
        }

        closeModals();
        e.target.reset();
        say(title + ' saved · ' + (audioUrl ? 'ready for CosmoBot' : 'no audio attached'));
      } catch (err) {
        say(err.message || 'Could not save lesson.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add audio lesson';
      }
    });
  }

  async function init(user) {
    currentUser = user;
    els.toast = $('toast');
    els.classes = $('classes');
    els.subjectList = $('subjectList');
    els.timeline = $('timeline');
    els.timetableFiles = $('timetableFiles');
    els.timetablePreview = $('timetablePreview');
    els.notesGrid = $('notesGrid');
    els.syllabusLabel = $('syllabusLabel');
    els.selectedClass = $('selectedClass');
    els.classStatus = $('classStatus');
    els.deleteClass = $('deleteClass');
    els.deviceDot = $('deviceDot');
    els.deviceLabel = $('deviceLabel');

    $('userName').textContent = user.name || user.email;
    $('userAvatar').textContent = initials(user.name || user.email);

    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.COSMOBOT_FIREBASE_CONFIG);
    window.cosmoBotFirebase = {
      app: app,
      firestore: firebase.firestore(),
      storage: firebase.storage(),
      rtdb: firebase.database(),
    };

    CosmoBotBackend.init(window.cosmoBotFirebase, user.uid);
    await CosmoBotBackend.linkDevice(CosmoBotBackend.DEFAULT_DEVICE);

    CosmoBotBackend.watchDevice(CosmoBotBackend.DEFAULT_DEVICE, updateDeviceStatus);
    bindUpload($('timetableUpload'), handleAddTimetable);
    bindUpload($('notesUpload'), handleAddNote);
    bindEvents();
    await loadClasses();

    lucide.createIcons();
    if (window.gsap) {
      gsap.from('.brand,.user,.device-status', { y: -18, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' });
      gsap.from('.intro > *', { y: 28, opacity: 0, duration: 0.75, stagger: 0.12, delay: 0.12, ease: 'power3.out' });
      gsap.from('.setup > *', { y: 34, opacity: 0, duration: 0.8, stagger: 0.14, delay: 0.28, ease: 'power3.out' });
      gsap.to('.stars', { backgroundPosition: '0 -230px', duration: 32, repeat: -1, ease: 'none' });
    }
  }

  window.CosmoBotDashboard = {
    init: init,
  };
})();
