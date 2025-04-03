document.addEventListener('DOMContentLoaded', () => {
    // Load leaderboard on page load
    fetchLeaderboard();

    // Handle hamburger menu toggle
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    const menuContent = document.querySelector('.menu-content');

    if (hamburgerIcon) {
        hamburgerIcon.addEventListener('click', () => {
            hamburgerMenu.classList.toggle('active');
        });
    }

    // Handle admin panel login
    const adminLink = document.getElementById('admin-link');
    const adminPanel = document.getElementById('admin-panel');
    const adminLogin = document.getElementById('admin-login');
    const adminControls = document.getElementById('admin-controls');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const clearInvalidUsersBtn = document.getElementById('clear-invalid-users-btn');
    const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');

    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('section').forEach(section => section.style.display = 'none');
            adminPanel.style.display = 'block';
            hamburgerMenu.classList.remove('active');
        });
    }

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            const password = adminPasswordInput.value;
            const ADMIN_PASSWORD = 'your-secret-password'; // This will be removed after testing

            if (password === ADMIN_PASSWORD) {
                adminLogin.style.display = 'none';
                adminControls.style.display = 'block';
                adminPasswordInput.dataset.password = password;
            } else {
                alert('Invalid admin password. Please try again.');
            }
        });
    }

    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            document.querySelectorAll('section').forEach(section => section.style.display = 'block');
            adminPanel.style.display = 'none';
            adminLogin.style.display = 'block';
            adminControls.style.display = 'none';
            adminPasswordInput.value = '';
        });
    }

    if (clearInvalidUsersBtn) {
        clearInvalidUsersBtn.addEventListener('click', async () => {
            const adminPassword = adminPasswordInput.dataset.password;
            try {
                const response = await fetch('/api/admin/clear-leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword })
                });

                if (response.ok) {
                    alert('Successfully cleared invalid users from the leaderboard!');
                    fetchLeaderboard();
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error clearing invalid users:', error);
                alert('Error clearing invalid users. Check the console for details.');
            }
        });
    }

    if (resetLeaderboardBtn) {
        resetLeaderboardBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to reset the entire leaderboard? This will remove all users and cannot be undone.')) {
                return;
            }

            const adminPassword = adminPasswordInput.dataset.password;
            try {
                const response = await fetch('/api/admin/reset-leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword })
                });

                if (response.ok) {
                    alert('Successfully reset the leaderboard!');
                    fetchLeaderboard();
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error resetting leaderboard:', error);
                alert('Error resetting leaderboard. Check the console for details.');
            }
        });
    }

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const xUsername = document.getElementById('x-username').value.trim();

            // Validate X username (must start with @ and contain only letters, numbers, or underscores)
            const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
            if (!xUsernameRegex.test(xUsername)) {
                alert('Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).');
                return;
            }

            try {
                const response = await fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xUsername })
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
    }

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
});
