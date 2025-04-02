document.addEventListener('DOMContentLoaded', () => {
    // Load leaderboard on page load
    fetchLeaderboard();

    // Handle hamburger menu toggle
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    const menuContent = document.querySelector('.menu-content');

    // Debug: Check if elements are found
    console.log('Hamburger Menu:', hamburgerMenu);
    console.log('Hamburger Icon:', hamburgerIcon);
    console.log('Menu Content:', menuContent);

    if (hamburgerIcon) {
        hamburgerIcon.addEventListener('click', () => {
            console.log('Hamburger icon clicked'); // Debug log
            hamburgerMenu.classList.toggle('active');
            console.log('Hamburger menu active state:', hamburgerMenu.classList.contains('active'));
        });
    } else {
        console.error('Hamburger icon not found!');
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

    // Debug: Check if elements are found
    console.log('Admin Link:', adminLink);
    console.log('Admin Panel:', adminPanel);
    console.log('Admin Login:', adminLogin);
    console.log('Admin Controls:', adminControls);
    console.log('Admin Password Input:', adminPasswordInput);
    console.log('Admin Login Button:', adminLoginBtn);
    console.log('Back to Home Button:', backToHomeBtn);
    console.log('Clear Invalid Users Button:', clearInvalidUsersBtn);
    console.log('Reset Leaderboard Button:', resetLeaderboardBtn);

    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Admin link clicked'); // Debug log
            // Hide other sections and show admin panel
            document.querySelectorAll('section').forEach(section => section.style.display = 'none');
            adminPanel.style.display = 'block';
            hamburgerMenu.classList.remove('active'); // Close the menu
        });
    } else {
        console.error('Admin link not found!');
    }

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            console.log('Admin login button clicked'); // Debug log
            const password = adminPasswordInput.value;
            const ADMIN_PASSWORD = 'your-secret-password'; // Change this to your secure password!

            if (password === ADMIN_PASSWORD) {
                adminLogin.style.display = 'none';
                adminControls.style.display = 'block';
                adminPasswordInput.dataset.password = password; // Store the password for later use
            } else {
                alert('Invalid admin password. Please try again.');
            }
        });
    } else {
        console.error('Admin login button not found!');
    }

    // Handle back to home button
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            console.log('Back to Home button clicked'); // Debug log
            // Hide admin panel and show other sections
            document.querySelectorAll('section').forEach(section => section.style.display = 'block');
            adminPanel.style.display = 'none';
            adminLogin.style.display = 'block';
            adminControls.style.display = 'none';
            adminPasswordInput.value = ''; // Clear the password input
        });
    } else {
        console.error('Back to Home button not found!');
    }

    // Handle clear invalid users button
    if (clearInvalidUsersBtn) {
        clearInvalidUsersBtn.addEventListener('click', async () => {
            console.log('Clear Invalid Users button clicked'); // Debug log
            const adminPassword = adminPasswordInput.dataset.password; // Retrieve the stored password
            try {
                const response = await fetch('/api/admin/clear-leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword })
                });

                if (response.ok) {
                    alert('Successfully cleared invalid users from the leaderboard!');
                    fetchLeaderboard(); // Refresh the leaderboard
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error clearing invalid users:', error);
                alert('Error clearing invalid users. Check the console for details.');
            }
        });
    } else {
        console.error('Clear Invalid Users button not found!');
    }

    // Handle reset leaderboard button
    if (resetLeaderboardBtn) {
        resetLeaderboardBtn.addEventListener('click', async () => {
            console.log('Reset Leaderboard button clicked'); // Debug log
            // Confirm the action with the user
            if (!confirm('Are you sure you want to reset the entire leaderboard? This will remove all users and cannot be undone.')) {
                return;
            }

            const adminPassword = adminPasswordInput.dataset.password; // Retrieve the stored password
            try {
                const response = await fetch('/api/admin/reset-leaderboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword })
                });

                if (response.ok) {
                    alert('Successfully reset the leaderboard!');
                    fetchLeaderboard(); // Refresh the leaderboard
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error resetting leaderboard:', error);
                alert('Error resetting leaderboard. Check the console for details.');
            }
        });
    } else {
        console.error('Reset Leaderboard button not found!');
    }

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
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
    } else {
        console.error('Profile form not found!');
    }
});

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
