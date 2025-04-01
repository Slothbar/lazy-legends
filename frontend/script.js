document.addEventListener('DOMContentLoaded', () => {
    // Load leaderboard on page load
    fetchLeaderboard();

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const xUsername = document.getElementById('x-username').value.trim();
        const hederaWallet = document.getElementById('hedera-wallet').value.trim();

        // Validate X username (must start with @ and contain only letters, numbers, or underscores)
        const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
        if (!xUsernameRegex.test(xUsername)) {
            alert('Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).');
            return;
        }

        // Validate Hedera wallet address (must start with 0.0)
        if (!hederaWallet.startsWith('0.0')) {
            alert('Invalid Hedera wallet address! It must start with 0.0 (e.g., 0.0.12345).');
            return;
        }

        // Additional Hedera wallet validation (basic format: 0.0 followed by numbers)
        const hederaWalletRegex = /^0\.0\.\d+$/;
        if (!hederaWalletRegex.test(hederaWallet)) {
            alert('Invalid Hedera wallet address format! It must be in the format 0.0.<number> (e.g., 0.0.12345).');
            return;
        }

        try {
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
                const errorData = await response.json();
                alert(`Error saving profile: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error submitting profile:', error);
            alert('Error saving profile. Check the console for details.');
        }
    });

    // Handle remove user form submission
    const removeUserForm = document.getElementById('remove-user-form');
    removeUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const xUsername = document.getElementById('remove-x-username').value.trim();

        // Validate X username format
        const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
        if (!xUsernameRegex.test(xUsername)) {
            alert('Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).');
            return;
        }

        try {
            const response = await fetch('/api/remove-user', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xUsername })
            });

            if (response.ok) {
                alert(`User ${xUsername} removed successfully!`);
                removeUserForm.reset();
                fetchLeaderboard(); // Refresh leaderboard
            } else {
                const errorData = await response.json();
                alert(`Error removing user: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error removing user:', error);
            alert('Error removing user. Check the console for details.');
        }
    });
});

// Function to fetch and display the leaderboard
async function fetchLeaderboard() {
    try {
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
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
    }
}
