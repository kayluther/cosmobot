/**
 * SpaceCanvas — hardware-optimized cosmic particle background
 */
(function () {
  const COLORS = {
    cyan: '34, 211, 238',
    purple: '168, 85, 247',
    blue: '96, 165, 250',
    white: '255, 255, 255',
  };

  function seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function createPlanet(rng) {
    const orbitRadius = 80 + rng() * 220;
    return {
      orbitRadius,
      orbitSpeed: 0.0003 + rng() * 0.0012,
      angle: rng() * Math.PI * 2,
      size: 3 + rng() * 8,
      color: rng() > 0.5 ? COLORS.cyan : COLORS.purple,
      tilt: (rng() - 0.5) * 0.4,
      hasRing: rng() > 0.7,
      ringTilt: rng() * Math.PI,
    };
  }

  function createStarCluster(rng, cx, cy) {
    const count = 12 + Math.floor(rng() * 20);
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        offsetX: (rng() - 0.5) * 60,
        offsetY: (rng() - 0.5) * 60,
        size: 0.5 + rng() * 1.5,
        twinkleSpeed: 0.002 + rng() * 0.004,
        twinklePhase: rng() * Math.PI * 2,
      });
    }
    return { cx, cy, stars, spinSpeed: 0.0002 + rng() * 0.0006, spinAngle: rng() * Math.PI * 2 };
  }

  function createGalaxy(rng, cx, cy) {
    const arms = 3 + Math.floor(rng() * 2);
    const particles = [];
    const total = 40 + Math.floor(rng() * 30);
    for (let i = 0; i < total; i++) {
      particles.push({
        arm: i % arms,
        t: (i / total) * Math.PI * 4,
        r: 10 + (i / total) * 50,
        size: 0.3 + rng() * 0.8,
        opacity: 0.1 + rng() * 0.3,
      });
    }
    return {
      cx, cy, particles,
      driftX: (rng() - 0.5) * 0.02,
      driftY: (rng() - 0.5) * 0.02,
      rotation: 0,
      rotSpeed: 0.0001 + rng() * 0.0002,
      scale: 0.6 + rng() * 0.8,
    };
  }

  function createDust(rng, w, h) {
    return {
      x: rng() * w, y: rng() * h,
      vx: (rng() - 0.5) * 0.15, vy: (rng() - 0.5) * 0.15,
      size: 0.3 + rng() * 0.7,
      opacity: 0.1 + rng() * 0.25,
    };
  }

  function initState(w, h, isMobile) {
    const rng = seededRandom(42);
    const cx = w / 2, cy = h / 2;
    return {
      cx, cy, width: w, height: h, isMobile, lastTime: 0,
      planets: Array.from({ length: isMobile ? 4 : 8 }, () => createPlanet(rng)),
      clusters: Array.from({ length: isMobile ? 3 : 6 }, () => createStarCluster(rng, rng() * w, rng() * h)),
      galaxies: Array.from({ length: isMobile ? 2 : 4 }, () => createGalaxy(rng, rng() * w, rng() * h)),
      dust: Array.from({ length: isMobile ? 40 : 80 }, () => createDust(rng, w, h)),
    };
  }

  window.initSpaceCanvas = function (canvasId) {
    const canvas = document.getElementById(canvasId || 'space-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    let state = null;
    let rafId = null;
    let visible = true;
    let frameCount = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = initState(rect.width, rect.height, rect.width < 768);
    }

    function drawBackground(w, h) {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, w * 0.8);
      grad.addColorStop(0, '#0B0F19');
      grad.addColorStop(0.5, '#060912');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    function drawGalaxy(g, delta) {
      g.rotation += g.rotSpeed * (delta * 0.06);
      g.cx += g.driftX; g.cy += g.driftY;
      if (g.cx < -80) g.cx = state.width + 80;
      if (g.cx > state.width + 80) g.cx = -80;
      if (g.cy < -80) g.cy = state.height + 80;
      if (g.cy > state.height + 80) g.cy = -80;
      ctx.save();
      ctx.translate(g.cx, g.cy);
      ctx.rotate(g.rotation);
      ctx.scale(g.scale, g.scale);
      for (const p of g.particles) {
        ctx.beginPath();
        ctx.arc(Math.cos(p.t + p.arm * 1.2) * p.r, Math.sin(p.t + p.arm * 1.2) * p.r * 0.4, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS.purple}, ${p.opacity})`;
        ctx.fill();
      }
      ctx.restore();
    }

    function drawCluster(c, delta) {
      c.spinAngle += c.spinSpeed * delta;
      ctx.save();
      ctx.translate(c.cx, c.cy);
      ctx.rotate(c.spinAngle);
      for (const s of c.stars) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(delta * s.twinkleSpeed + s.twinklePhase));
        ctx.beginPath();
        ctx.arc(s.offsetX, s.offsetY, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS.white}, ${tw * 0.8})`;
        ctx.fill();
      }
      ctx.restore();
    }

    function drawPlanet(p, cx, cy, delta) {
      p.angle += p.orbitSpeed * delta;
      const x = cx + Math.cos(p.angle) * p.orbitRadius;
      const y = cy + Math.sin(p.angle) * p.orbitRadius * (1 + p.tilt);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3);
      glow.addColorStop(0, `rgba(${p.color}, 0.9)`);
      glow.addColorStop(0.5, `rgba(${p.color}, 0.3)`);
      glow.addColorStop(1, `rgba(${p.color}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, p.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.fill();
      if (p.hasRing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.ringTilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${p.color}, 0.35)`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawDust(d) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = state.width;
      if (d.x > state.width) d.x = 0;
      if (d.y < 0) d.y = state.height;
      if (d.y > state.height) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COLORS.blue}, ${d.opacity})`;
      ctx.fill();
    }

    function render(ts) {
      if (!visible || !state) { rafId = requestAnimationFrame(render); return; }
      const delta = state.lastTime ? ts - state.lastTime : 16;
      state.lastTime = ts;
      const { width: w, height: h, cx, cy, planets, clusters, galaxies, dust, isMobile } = state;

      drawBackground(w, h);
      if (!isMobile || frameCount % 2 === 0) {
        ctx.strokeStyle = `rgba(${COLORS.cyan}, 0.04)`;
        ctx.lineWidth = 0.5;
        for (const p of planets) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, p.orbitRadius, p.orbitRadius * (1 + p.tilt), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      for (const g of galaxies) drawGalaxy(g, delta);
      for (const c of clusters) drawCluster(c, delta);
      if (!isMobile || frameCount % 2 === 0) {
        for (const p of planets) drawPlanet(p, cx, cy, delta);
      }
      for (const d of dust) drawDust(d);
      frameCount++;
      rafId = requestAnimationFrame(render);
    }

    document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
    window.addEventListener('resize', resize);
    resize();
    rafId = requestAnimationFrame(render);
  };

  document.addEventListener('DOMContentLoaded', () => initSpaceCanvas('space-canvas'));
})();
