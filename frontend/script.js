document.addEventListener('DOMContentLoaded', () => {
    // Load leaderboard on page load
    fetchLeaderboard();

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const xUsername = document.getElementById('x-username').value;
        const hederaWallet = document.getElementById('hedera-wallet').value;

        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xUsername, hederaWallet })
        });

        if (response.ok) {
            alert('Profile saved successfully!');
            profileForm.reset();
            fetchLeaderboard(); // Refresh leaderboard
        } else {
            alert('Error saving profile.');
        }
    });
});

async function fetchLeaderboard() {
    const response = await fetch('/api/leaderboard');
    const leaderboard = await response.json();
    const leaderboardBody = document.getElementById('leaderboard-body');
    leaderboardBody.innerHTML = '';

    leaderboard.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${entry.xUsername}</td>
            <td>${entry.sloMoPoints}</td>
        `;
        leaderboardBody.appendChild(row);
    });
}
