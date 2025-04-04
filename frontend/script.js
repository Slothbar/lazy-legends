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
    const adminUsers = document.getElementById('admin-users');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const clearInvalidUsersBtn = document.getElementById('clear-invalid-users-btn');
    const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
    const viewAllUsersBtn = document.getElementById('view-all-users-btn');
    const backToControlsBtn = document.getElementById('back-to-controls-btn');

    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('section').forEach(section => section.style.display = 'none');
            adminPanel.style.display = 'block';
            hamburgerMenu.classList.remove('active');
        });
    }

    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', async () => {
            const password = adminPasswordInput.value;

            try {
                const response = await fetch('/api/admin/verify-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: password })
                });

                if (response.ok) {
                    adminLogin.style.display = 'none';
                    adminControls.style.display = 'block';
                    adminPasswordInput.dataset.password = password;
                } else {
                    const errorData = await response.json();
                    alert(errorData.error || 'Invalid admin password. Please try again.');
                }
            } catch (error) {
                console.error('Error verifying admin password:', error);
                alert('Error verifying admin password. Check the console for details.');
            }
        });
    }

    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            document.querySelectorAll('section').forEach(section => section.style.display = 'block');
            adminPanel.style.display = 'none';
            adminLogin.style.display = 'block';
            adminControls.style.display = 'none';
            adminUsers.style.display = 'none';
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
            if (!confirm('Are you sure you want to reset the leaderboard? This will reset all SloMo Points to 0 and start a new season.')) {
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
                    alert('Successfully reset the leaderboard and started a new season!');
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

    if (viewAllUsersBtn) {
        viewAllUsersBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/admin/users', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const users = await response.json();
                    const usersTableBody = document.getElementById('users-table-body');
                    usersTableBody.innerHTML = '';

                    users.forEach(user => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${user.xUsername}</td>
                            <td>${user.hederaWallet || 'N/A'}</td>
                            <td>${user.sloMoPoints}</td>
                        `;
                        usersTableBody.appendChild(row);
                    });

                    adminControls.style.display = 'none';
                    adminUsers.style.display = 'block';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
                alert('Error fetching users. Check the console for details.');
            }
        });
    }

    if (backToControlsBtn) {
        backToControlsBtn.addEventListener('click', () => {
            adminUsers.style.display = 'none';
            adminControls.style.display = 'block';
        });
    }

    // Handle profile form submission (Step 1: X Username)
    const profileFormStep1 = document.getElementById('profile-form-step1');
    const profileFormStep2 = document.getElementById('profile-form-step2');
    const formFeedback = document.getElementById('form-feedback');
    const nextStepsSection = document.getElementById('next-steps-section');
    const profileSection = document.getElementById('profile-section');

    if (profileFormStep1) {
        profileFormStep1.addEventListener('submit', (e) => {
            e.preventDefault();
            const xUsernameInput = document.getElementById('x-username');
            let xUsername = xUsernameInput.value.trim();

            // Auto-prepend @ if missing
            if (!xUsername.startsWith('@')) {
                xUsername = '@' + xUsername;
                xUsernameInput.value = xUsername;
            }

            // Validate X username
            const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
            if (!xUsernameRegex.test(xUsername)) {
                formFeedback.style.display = 'block';
                formFeedback.style.color = '#d9534f';
                formFeedback.textContent = 'Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).';
                return;
            }

            // Move to Step 2
            profileFormStep1.style.display = 'none';
            profileFormStep2.style.display = 'block';
            formFeedback.style.display = 'none';
        });
    }

    // Handle profile form submission (Step 2: Wallet Address)
    if (profileFormStep2) {
        profileFormStep2.addEventListener('submit', async (e) => {
            e.preventDefault();
            const xUsername = document.getElementById('x-username').value.trim();
            const hederaWallet = document.getElementById('hedera-wallet').value.trim();

            // Validate wallet address if provided
            let walletAddress = hederaWallet || 'N/A';
            if (hederaWallet) {
                const walletRegex = /^0\.0\.\d+$/;
                if (!walletRegex.test(hederaWallet)) {
                    formFeedback.style.display = 'block';
                    formFeedback.style.color = '#d9534f';
                    formFeedback.textContent = 'Invalid Hedera wallet address! It must start with 0.0. followed by numbers (e.g., 0.0.12345).';
                    return;
                }
                walletAddress = hederaWallet;
            }

            try {
                const response = await fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xUsername, hederaWallet: walletAddress })
                });

                if (response.ok) {
                    const bonusPoints = walletAddress !== 'N/A' ? 5 : 0;
                    const feedbackMessage = walletAddress !== 'N/A'
                        ? `Welcome ${xUsername}! You’ve earned 5 bonus SloMo Points for linking your wallet address. Start posting #LazyLegends to climb the leaderboard!`
                        : `Welcome ${xUsername}! You’re ready to start posting #LazyLegends. Add your wallet address later to be eligible for season rewards!`;
                    formFeedback.style.display = 'block';
                    formFeedback.style.color = '#4a7c59';
                    formFeedback.textContent = feedbackMessage;
                    profileFormStep2.style.display = 'none';
                    profileFormStep1.style.display = 'none';
                    profileFormStep1.reset();
                    profileFormStep2.reset();
                    nextStepsSection.style.display = 'block';
                    fetchLeaderboard(); // Refresh leaderboard
                } else {
                    const errorData = await response.json();
                    formFeedback.style.display = 'block';
                    formFeedback.style.color = '#d9534f';
                    formFeedback.textContent = `Error saving profile: ${errorData.error || 'Unknown error'}`;
                }
            } catch (error) {
                console.error('Error submitting profile:', error);
                formFeedback.style.display = 'block';
                formFeedback.style.color = '#d9534f';
                formFeedback.textContent = 'Error saving profile. Check the console for details.';
            }
        });
    }

    // Handle skipping the wallet address
    const skipWalletBtn = document.getElementById('skip-wallet-btn');
    if (skipWalletBtn) {
        skipWalletBtn.addEventListener('click', () => {
            document.getElementById('hedera-wallet').value = '';
            profileFormStep2.dispatchEvent(new Event('submit'));
        });
    }

    // Handle "Tweet Now" button
    const tweetNowBtn = document.getElementById('tweet-now-btn');
    if (tweetNowBtn) {
        tweetNowBtn.addEventListener('click', () => {
            const tweetText = encodeURIComponent('Just napping like a sloth on a sunny day! #LazyLegends');
            const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
            window.open(tweetUrl, '_blank');
        });
    }

    async function fetchLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const leaderboard = await response.json();
            const leaderboardBody = document.getElementById('leaderboard-body');
            leaderboardBody.innerHTML = '';

            leaderboard.forEach((entry, index) => {
                const rank = index + 1;
                let rankDisplay = rank.toString();
                if (rank === 1) rankDisplay = '🏆 1';
                else if (rank === 2) rankDisplay = '🥈 2';
                else if (rank === 3) rankDisplay = '🥉 3';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${rankDisplay}</td>
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
