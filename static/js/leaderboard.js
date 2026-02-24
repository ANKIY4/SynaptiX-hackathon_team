// Poll leaderboard data periodically
function refreshLeaderboard() {
    fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById('leaderboardTable');
            if (!table || data.length === 0) return;

            let html = '';
            data.forEach((entry, idx) => {
                const topClass = idx < 3 ? `lb-top-${idx + 1}` : '';
                let rankDisplay;
                if (entry.rank === 1) rankDisplay = '#1';
                else if (entry.rank === 2) rankDisplay = '#2';
                else if (entry.rank === 3) rankDisplay = '#3';
                else rankDisplay = entry.rank;

                html += `
                    <div class="lb-row ${topClass}">
                        <div class="lb-rank">${rankDisplay}</div>
                        <div class="lb-user">
                            <span class="lb-username">${entry.username}</span>
                            <span class="lb-level">Level ${entry.level}</span>
                        </div>
                        <div class="lb-stats">
                            <span class="lb-exams">${entry.exams_taken} exams</span>
                        </div>
                        <div class="lb-xp">
                            <span class="lb-xp-value">${entry.xp}</span>
                            <span class="lb-xp-label">XP</span>
                        </div>
                    </div>
                `;
            });

            if (table.dataset.snapshot === html) return;
            table.dataset.snapshot = html;
            table.classList.add('is-updating');
            table.innerHTML = html;
            window.setTimeout(() => table.classList.remove('is-updating'), 180);
        })
        .catch(err => console.error('Leaderboard refresh error:', err));
}

refreshLeaderboard();
// refresh every 5s
setInterval(refreshLeaderboard, 5000);
