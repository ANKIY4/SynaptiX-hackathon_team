/**
 * Vision-based Anti-Cheat Proctoring System
 * - MediaPipe Face Mesh: head pose & eye gaze detection
 * - TensorFlow.js COCO-SSD: phone detection
 */

class VisionAntiCheat {
    constructor(options) {
        this.examId = options.examId;
        this.formId = options.formId;
        this.csrfToken = options.csrfToken;
        this.subjectName = (options.subjectName || '').toLowerCase();

        // Thresholds (seconds)
        this.HEAD_AWAY_LIMIT = 15;
        this.EYE_AWAY_LIMIT = this.subjectName === 'mathematics' ? 90 : 30;
        this.PHONE_CONFIDENCE = 0.45;
        this.COCO_INTERVAL = 2000;

        // Accumulated time (resets when user looks back)
        this.headAwayTime = 0;
        this.eyeAwayTime = 0;
        this.lastTick = 0;

        // Detection flags
        this.facePresent = false;
        this.headOk = true;
        this.eyesOk = true;
        this.cancelled = false;
        this.modelsReady = false;

        // References
        this.video = null;
        this.faceMesh = null;
        this.cocoModel = null;
        this.cocoLastRun = 0;
        this.animFrameId = null;
    }

    /* ───────── public ───────── */
    async start() {
        try {
            this._buildUI();
            await this._initCamera();
            await this._loadModels();
            this.modelsReady = true;
            this._setStatus('active', '🟢 Proctoring Active');
            this.lastTick = performance.now();
            this._loop();
        } catch (err) {
            console.error('[VisionAC]', err);
            this._setStatus('error', '⚠️ Camera required for exam');
        }
    }

    destroy() {
        this.cancelled = true;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
        }
    }

    /* ───────── UI ───────── */
    _buildUI() {
        const wrap = document.createElement('div');
        wrap.id = 'proctorWrap';
        wrap.innerHTML = `
            <video id="proctorVideo" autoplay playsinline muted></video>
            <div class="proctor-badge" id="proctorBadge">
                <span class="proctor-dot" id="proctorDot"></span>
                <span id="proctorLabel">Initializing…</span>
            </div>
            <div class="proctor-timers" id="proctorTimers">
                <div class="proctor-timer" id="ptHead" style="display:none">
                    👤 Head&nbsp;<span id="ptHeadVal">0</span>/${this.HEAD_AWAY_LIMIT}s
                    <div class="proctor-timer-bar"><div class="proctor-timer-fill" id="ptHeadBar"></div></div>
                </div>
                <div class="proctor-timer" id="ptEye" style="display:none">
                    👁️ Eyes&nbsp;<span id="ptEyeVal">0</span>/${this.EYE_AWAY_LIMIT}s
                    <div class="proctor-timer-bar"><div class="proctor-timer-fill" id="ptEyeBar"></div></div>
                </div>
            </div>`;
        const target = document.querySelector('.exam-header');
        if (target) target.parentNode.insertBefore(wrap, target);
        else document.body.prepend(wrap);
        this.video = document.getElementById('proctorVideo');
    }

    /* ───────── Camera ───────── */
    async _initCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' }, audio: false
        });
        this.video.srcObject = stream;
        await this.video.play();
    }

    /* ───────── Models ───────── */
    async _loadModels() {
        this._setStatus('loading', '⏳ Loading AI models…');

        // Face Mesh
        if (window.FaceMesh) {
            this.faceMesh = new window.FaceMesh({
                locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`
            });
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            await new Promise((res, rej) => {
                this.faceMesh.onResults(r => { this._onFace(r); });
                this.faceMesh.initialize().then(res).catch(rej);
            });
        }

        // COCO-SSD (phone detection)
        if (window.cocoSsd) {
            this.cocoModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        }
    }

    /* ───────── Detection loop ───────── */
    _loop() {
        if (this.cancelled) return;
        const now = performance.now();
        const dt = (now - this.lastTick) / 1000;
        this.lastTick = now;

        // Send frame to face mesh
        if (this.faceMesh && this.video.readyState >= 2) {
            this.faceMesh.send({ image: this.video }).catch(() => {});
        }

        // Phone detection (throttled)
        if (this.cocoModel && this.video.readyState >= 2 && (now - this.cocoLastRun) > this.COCO_INTERVAL) {
            this.cocoLastRun = now;
            this.cocoModel.detect(this.video).then(preds => {
                if (this.cancelled) return;
                const phone = preds.find(p => p.class === 'cell phone' && p.score >= this.PHONE_CONFIDENCE);
                if (phone) this._cancel('Phone detected in camera view');
            }).catch(() => {});
        }

        this._tick(dt);
        this.animFrameId = requestAnimationFrame(() => this._loop());
    }

    /* ───────── Face Mesh results ───────── */
    _onFace(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            this.facePresent = false;
            this.headOk = false;
            this.eyesOk = false;
            return;
        }
        this.facePresent = true;
        const lm = results.multiFaceLandmarks[0];
        this.headOk = this._headStraight(lm);
        this.eyesOk = this._eyesStraight(lm);
    }

    /* Head pose: compare nose-to-eye distances for yaw, nose-to-forehead/chin for pitch */
    _headStraight(lm) {
        const nose = lm[1];
        const lEye = lm[33];
        const rEye = lm[263];
        const ratio = Math.abs(nose.x - lEye.x) / (Math.abs(nose.x - rEye.x) + 1e-4);
        if (ratio < 0.45 || ratio > 2.2) return false;

        const forehead = lm[10];
        const chin = lm[152];
        const vRatio = Math.abs(nose.y - forehead.y) / (Math.abs(chin.y - nose.y) + 1e-4);
        return vRatio > 0.35 && vRatio < 2.8;
    }

    /* Eye gaze: iris position relative to eye corners */
    _eyesStraight(lm) {
        if (lm.length <= 468) return true; // no iris data
        const li = this._avg(lm, [468, 469, 470, 471, 472]);
        const ri = this._avg(lm, [473, 474, 475, 476, 477]);
        const lr = (li.x - lm[33].x) / (lm[133].x - lm[33].x + 1e-4);
        const rr = (ri.x - lm[263].x) / (lm[362].x - lm[263].x + 1e-4);
        return lr > 0.22 && lr < 0.78 && rr > 0.22 && rr < 0.78;
    }

    _avg(lm, ids) {
        let x = 0, y = 0;
        for (const i of ids) { x += lm[i].x; y += lm[i].y; }
        return { x: x / ids.length, y: y / ids.length };
    }

    /* ───────── Timer logic ───────── */
    _tick(dt) {
        const hEl = document.getElementById('ptHead');
        const hVal = document.getElementById('ptHeadVal');
        const hBar = document.getElementById('ptHeadBar');
        const eEl = document.getElementById('ptEye');
        const eVal = document.getElementById('ptEyeVal');
        const eBar = document.getElementById('ptEyeBar');

        // Head away
        if (!this.facePresent || !this.headOk) {
            this.headAwayTime += dt;
            if (hEl) hEl.style.display = 'flex';
            if (hVal) hVal.textContent = Math.floor(this.headAwayTime);
            if (hBar) hBar.style.width = Math.min(100, (this.headAwayTime / this.HEAD_AWAY_LIMIT) * 100) + '%';
            if (this.headAwayTime >= this.HEAD_AWAY_LIMIT) {
                this._cancel('Looked away from camera for more than 15 seconds');
                return;
            }
        } else {
            this.headAwayTime = 0;
            if (hEl) hEl.style.display = 'none';
        }

        // Eye gaze away (only when face is present but eyes wander)
        if (this.facePresent && !this.eyesOk) {
            this.eyeAwayTime += dt;
            if (eEl) eEl.style.display = 'flex';
            if (eVal) eVal.textContent = Math.floor(this.eyeAwayTime);
            if (eBar) eBar.style.width = Math.min(100, (this.eyeAwayTime / this.EYE_AWAY_LIMIT) * 100) + '%';
            if (this.eyeAwayTime >= this.EYE_AWAY_LIMIT) {
                const msg = this.subjectName === 'mathematics'
                    ? 'Eyes looking away for more than 1.5 minutes'
                    : 'Eyes looking away for more than 30 seconds';
                this._cancel(msg);
                return;
            }
        } else {
            this.eyeAwayTime = 0;
            if (eEl) eEl.style.display = 'none';
        }

        // Status label
        if (!this.facePresent) this._setStatus('warn', '⚠️ Face not visible');
        else if (!this.headOk) this._setStatus('warn', '⚠️ Look at the screen');
        else if (!this.eyesOk) this._setStatus('caution', '👁️ Eyes wandering');
        else this._setStatus('active', '🟢 Proctoring Active');
    }

    /* ───────── Status badge ───────── */
    _setStatus(type, text) {
        const dot = document.getElementById('proctorDot');
        const label = document.getElementById('proctorLabel');
        if (dot) { dot.className = 'proctor-dot'; dot.classList.add('dot-' + type); }
        if (label) label.textContent = text;
    }

    /* ───────── Cancel exam ───────── */
    async _cancel(reason) {
        if (this.cancelled) return;
        this.cancelled = true;
        this._setStatus('cancelled', '🔴 Exam Cancelled');
        this.destroy();

        // Overlay
        const ov = document.createElement('div');
        ov.className = 'vision-cancel-overlay';
        ov.innerHTML = `
            <div class="vision-cancel-modal">
                <div class="vision-cancel-icon">🚫</div>
                <h2>Exam Cancelled</h2>
                <p class="vision-cancel-reason">${this._escHtml(reason)}</p>
                <p class="vision-cancel-sub">The anti-cheat proctoring system detected a violation.</p>
                <p class="vision-cancel-redirect">Redirecting in 3 seconds…</p>
            </div>`;
        document.body.appendChild(ov);

        // Notify backend
        try {
            await fetch(`/exams/cancel/${this.examId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ reason })
            });
        } catch (e) { console.error('[VisionAC] cancel notify failed', e); }

        setTimeout(() => { window.location.href = `/exams/cancelled/${this.examId}`; }, 3000);
    }

    _escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
}
