document.addEventListener('DOMContentLoaded', () => {
    // Load leaderboard on page load
    fetchLeaderboard();

    // Handle hamburger menu toggle
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    hamburgerIcon.addEventListener('click', () => {
        hamburgerMenu.classList.toggle('active');
    });

    // Handle admin panel login
    const adminLink = document.getElementById('admin-link');
    const adminPanel = document.getElementById('admin-panel');
    const adminLogin = document.getElementById('admin-login');
    const adminControls = document.getElementById('admin-controls');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const clearInvalidUsersBtn = document.getElementById('clear-invalid-users-btn');

    // Debug: Check if elements are found
    console.log('Admin Link:', adminLink);
    console.log('Admin Panel:', adminPanel);
    console.log('Admin Login:', adminLogin);
    console.log('Admin Controls:', adminControls);
    console.log('Admin Password Input:', adminPasswordInput);
    console.log('Admin Login Button:', adminLoginBtn);
    console.log('Back to Home Button:', backToHomeBtn);
    console.log('Clear Invalid Users Button:', clearInvalidUsersBtn);

    adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Hide other sections and show admin panel
        document.querySelectorAll('section').forEach(section => section.style.display = 'none');
        adminPanel.style.display = 'block';
        hamburgerMenu.classList.remove('active'); // Close the menu
    });

    adminLoginBtn.addEventListener('click', () => {
        const password = adminPasswordInput.value;
        const ADMIN_PASSWORD = 'your-secret-password'; // This will be removed after testing

        if (password === ADMIN_PASSWORD) {
            adminLogin.style.display = 'none';
            adminControls.style.display = 'block';
            adminPasswordInput.dataset.password = password; // Store the password for later use
        } else {
            alert('Invalid admin password. Please try again.');
        }
    });

    // Handle back to home button
    backToHomeBtn.addEventListener('click', () => {
        console.log('Back to Home button clicked'); // Debug log
        // Hide admin panel and show other sections
        document.querySelectorAll('section').forEach(section => section.style.display = 'block');
        adminPanel.style.display = 'none';
        adminLogin.style.display = 'block';
        adminControls.style.display = 'none';
        adminPasswordInput.value = ''; // Clear the password input
    });

    // Handle clear invalid users button
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
                <td>${entry
