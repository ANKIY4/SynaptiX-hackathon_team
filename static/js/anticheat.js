// Tab switch detection + question swap
let warningCount = 0;
const MAX_WARNINGS = 3;
let swapping = false;
let submitting = false;

function initAntiCheat(formId, examId) {
    // Mark form submission so blur/visibility handlers don't fire
    const form = document.getElementById(formId);
    if (form) {
        form.addEventListener('submit', function () { submitting = true; });
    }

    // visibility change
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && !swapping && !submitting) {
            handleTabSwitch(formId, examId);
        }
    });

    // alt-tab / clicking outside
    window.addEventListener('blur', function () {
        if (!swapping && !submitting) {
            handleTabSwitch(formId, examId);
        }
    });

    // no right-click
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        return false;
    });

    // block copy/paste/view-source/devtools
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u')) {
            e.preventDefault();
            return false;
        }
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }
    });
}

function handleTabSwitch(formId, examId) {
    warningCount++;
    updateWarningUI();
    if (warningCount >= MAX_WARNINGS) {
        autoSubmitExam(formId);
    } else {
        // swap current question
        swapQuestion(examId);
        showWarningOverlay();
    }
}

function swapQuestion(examId) {
    swapping = true;
    const csrfToken = document.querySelector('input[name="csrf_token"]');
    const token = csrfToken ? csrfToken.value : '';

    fetch(`/exams/swap_question/${examId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': token
        }
    })
    .then(res => res.json())
    .then(data => {
        swapping = false;
        if (data.status === 'swapped') {
            // reload to show new question once user dismisses
            window._questionSwapped = true;
        }
    })
    .catch(() => { swapping = false; });
}

function showWarningOverlay() {
    const overlay = document.getElementById('cheatOverlay');
    const countEl = document.getElementById('overlayWarningCount');
    if (overlay) {
        overlay.style.display = 'flex';
        if (countEl) countEl.textContent = warningCount;
    }
}

function dismissWarning() {
    const overlay = document.getElementById('cheatOverlay');
    if (overlay) overlay.style.display = 'none';
    // reload to show swapped question
    if (window._questionSwapped) {
        window._questionSwapped = false;
        location.reload();
    }
}

function updateWarningUI() {
    const badge = document.getElementById('warningCount');
    if (badge) badge.textContent = warningCount;
}

function autoSubmitExam(formId) {
    alert('You have exceeded the maximum number of tab switches. Your exam will be submitted automatically.');
    const form = document.getElementById(formId);
    if (form) form.submit();
}
