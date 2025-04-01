document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();

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
            fetchLeaderboard();
        } else {
            alert('Error saving profile.');
        }
    });

    document.getElementById('view-profile-btn').addEventListener('click', async () => {
        const xUsername = prompt('Enter your X username to view your profile (e.g., @slothhbar):');
        if (!xUsername) return;

        const response = await fetch(`/api/profile/${xUsername}`);
        const profile = await response.json();

        if (response.ok) {
            document.getElementById('profile-x-username').textContent = profile.xUsername;
            document.getElementById('profile-hedera-wallet').textContent = profile.hederaWallet;
            document.getElementById('profile-slo-mo-points').textContent = profile.sloMoPoints;

            document.querySelectorAll('section').forEach(section => section.style.display = 'none');
            document.getElementById('profile-view-section').style.display = 'block';
        } else {
            alert('Profile not found! Make sure you entered the correct X username.');
        }
    });

    document.getElementById('back-to-game-btn').addEventListener('click', () => {
        document.querySelectorAll('section').forEach(section => section.style.display = 'block');
        document.getElementById('profile-view-section').style.display = 'none';
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
