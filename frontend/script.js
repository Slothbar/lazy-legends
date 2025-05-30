import { HashConnect }      from "hashconnect";
import { createHederaClient } from "./hederaClient.js";

const hashconnect       = new HashConnect();
let   walletAccountData = null;

async function connectHashPack() {
  // 1) init HashConnect
  const initData = await hashconnect.init({
    name:        "Lazy Legends DApp",
    description: "Chill2Earn with $SLOTH on Hedera",
    icon:        "/icon.png",
  });
  // 2) connect your local HashPack
  await hashconnect.connectToLocalWallet(initData.topic);
  walletAccountData = hashconnect.findConnectedAccount(initData.topic);
  document.getElementById("wallet-account")
          .innerText = `Connected: ${walletAccountData.accountId}`;
}

document.getElementById("connect-wallet-btn")
        .addEventListener("click", connectHashPack);

// (Optionally) helper to call your back-end mint endpoint:
async function buyLegend(itemId) {
  if (!walletAccountData) {
    return alert("Connect your wallet first!");
  }
  const resp = await fetch("/api/mint", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      accountId: walletAccountData.accountId,
      itemId
    }),
  });
  const { txId } = await resp.json();
  alert(`Mint submitted: ${txId}`);
}

// then your existing DOMContentLoaded handler continues…
document.addEventListener('DOMContentLoaded', () => {

    // Load announcement on page load
    fetchAnnouncement();

    // Load leaderboard on page load
    fetchLeaderboard();

    // Load season winners on page load
    fetchSeasonWinners();

    // Load season dates and start timer
    fetchSeasonDates();

    // Load recent activity on page load
    fetchRecentActivity();

    // Handle hamburger menu toggle
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    const menuContent = document.querySelector('.menu-content');

    if (hamburgerIcon) {
        hamburgerIcon.addEventListener('click', () => {
            hamburgerMenu.classList.toggle('active');
        });
    }

    // Handle dark mode toggle
    const toggleButton = document.getElementById('dark-mode-toggle');
    const body = document.body;

    if (toggleButton) {
        // Load saved theme from localStorage
        if (localStorage.getItem('theme') === 'dark') {
            body.classList.add('dark-mode');
            toggleButton.setAttribute('aria-label', 'Switch to light mode');
        }

        // Toggle theme on button click
        toggleButton.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDarkMode = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            toggleButton.setAttribute('aria-label', isDarkMode ? 'Switch to light mode' : 'Toggle dark mode');
            hamburgerMenu.classList.remove('active'); // Close menu after toggle
        });
    }

    // Handle season timer
    let seasonStartDate = new Date('2025-05-01T00:00:00-05:00');
    let seasonEndDate = new Date('2025-05-29T00:00:00-05:00');

    function updateSeasonTimer() {
        const now = new Date();
        const timerText = document.getElementById('timer-text');
        if (!timerText) return;

        let targetDate, prefix;
        if (now < seasonStartDate) {
            targetDate = seasonStartDate;
            prefix = 'Season Starts In: ';
        } else if (now < seasonEndDate) {
            targetDate = seasonEndDate;
            prefix = 'Season Ends In: ';
        } else {
            timerText.textContent = 'Season has ended! Check back for the next season.';
            return;
        }

        const diff = targetDate - now;
        if (diff <= 0) {
            timerText.textContent = 'Season has ended! Check back for the next season.';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timerText.textContent = `${prefix}${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    async function fetchSeasonDates() {
        try {
            const response = await fetch('/api/admin/season-dates', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                seasonStartDate = new Date(data.startDate);
                seasonEndDate = new Date(data.endDate);
                localStorage.setItem('seasonDates', JSON.stringify({ startDate: data.startDate, endDate: data.endDate }));
                updateSeasonTimer();
                setInterval(updateSeasonTimer, 1000);
            } else {
                console.error('Error fetching season dates:', await response.json());
                // Fallback to hardcoded dates
                updateSeasonTimer();
                setInterval(updateSeasonTimer, 1000);
            }
        } catch (error) {
            console.error('Error fetching season dates:', error);
            // Fallback to hardcoded dates
            updateSeasonTimer();
            setInterval(updateSeasonTimer, 1000);
        }
    }

    async function fetchRecentActivity() {
        const activityList = document.getElementById('recent-activity-list');
        if (!activityList) return;

        // Mock data for CodePen or when API is unavailable
        const mockData = [
            { xUsername: '@SlothLad', points: 2, timestamp: new Date().toISOString() },
            { xUsername: '@ChillSloth', points: 4, timestamp: new Date(Date.now() - 60000).toISOString() },
            { xUsername: '@LazyKing', points: 2, timestamp: new Date(Date.now() - 120000).toISOString() }
        ];

        try {
            const response = await fetch('/api/recent-activity', {
                credentials: 'include'
            });
            let activities = mockData; // Default to mock data
            if (response.ok) {
                activities = await response.json();
            } else {
                console.error('Error fetching recent activity:', await response.json());
            }

            activityList.innerHTML = '';
            activities.slice(0, 5).forEach(activity => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="username">${activity.xUsername}</span> just earned ${activity.points} SloMo points!`;
                activityList.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            activityList.innerHTML = '';
            mockData.slice(0, 5).forEach(activity => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="username">${activity.xUsername}</span> just earned ${activity.points} SloMo points!`;
                activityList.appendChild(li);
            });
        }
    }

    // Handle admin panel login
    const adminLink = document.getElementById('admin-link');
    const adminPanel = document.getElementById('admin-panel');
    const adminLogin = document.getElementById('admin-login');
    const adminControls = document.getElementById('admin-controls');
    const adminUsers = document.getElementById('admin-users');
    const adminAnnouncement = document.getElementById('admin-announcement');
    const adminSeasonDates = document.getElementById('admin-season-dates');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const clearInvalidUsersBtn = document.getElementById('clear-invalid-users-btn');
    const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
    const viewAllUsersBtn = document.getElementById('view-all-users-btn');
    const editAnnouncementBtn = document.getElementById('edit-announcement-btn');
    const editSeasonDatesBtn = document.getElementById('edit-season-dates-btn');
    const saveAnnouncementBtn = document.getElementById('save-announcement-btn');
    const saveSeasonDatesBtn = document.getElementById('save-season-dates-btn');
    const backToControlsBtn = document.getElementById('back-to-controls-btn');
    const backToControlsFromAnnouncementBtn = document.getElementById('back-to-controls-from-announcement-btn');
    const backToControlsFromSeasonDatesBtn = document.getElementById('back-to-controls-from-season-dates-btn');

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
            adminAnnouncement.style.display = 'none';
            adminSeasonDates.style.display = 'none';
            adminPasswordInput.value = '';
            window.history.pushState({}, '', '/');
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
                    fetchSeasonWinners();
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
                            <td><button class="delete-user-btn destructive-btn" data-username="${user.xUsername}">Delete</button></td>
                        `;
                        usersTableBody.appendChild(row);
                    });

                    // Add event listeners for delete buttons
                    document.querySelectorAll('.delete-user-btn').forEach(button => {
                        button.addEventListener('click', async () => {
                            const xUsername = button.dataset.username;
                            if (!confirm(`Are you sure you want to permanently delete ${xUsername}? This action cannot be undone.`)) {
                                return;
                            }

                            const adminPassword = adminPasswordInput.dataset.password;
                            try {
                                const response = await fetch('/api/admin/delete-user', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ adminPassword, xUsername })
                                });

                                if (response.ok) {
                                    alert(`Successfully deleted user ${xUsername}!`);
                                    button.closest('tr').remove();
                                    fetchLeaderboard();
                                    fetchRecentActivity();
                                } else {
                                    const errorData = await response.json();
                                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                                }
                            } catch (error) {
                                console.error(`Error deleting user ${xUsername}:`, error);
                                alert('Error deleting user. Check the console for details.');
                            }
                        });
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

    if (editAnnouncementBtn) {
        editAnnouncementBtn.addEventListener('click', async () => {
            const announcementInput = document.getElementById('announcement-input');
            if (!announcementInput) {
                console.error('announcementInput element not found');
                alert('Error: Announcement input field not found. Please check the page structure.');
                return;
            }

            try {
                const response = await fetch('/api/admin/announcement');
                if (response.ok) {
                    const data = await response.json();
                    console.log('Fetched announcement data:', data);
                    announcementInput.value = data.text;
                    adminControls.style.display = 'none';
                    adminAnnouncement.style.display = 'block';
                } else {
                    const errorData = await response.json();
                    console.error('Error fetching announcement:', errorData);
                    alert(`Error fetching announcement: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error fetching announcement:', error);
                alert('Error fetching announcement. Check the console for details.');
            }
        });
    }

    if (editSeasonDatesBtn) {
        editSeasonDatesBtn.addEventListener('click', async () => {
            const startDateInput = document.getElementById('season-start-date');
            const endDateInput = document.getElementById('season-end-date');
            if (!startDateInput || !endDateInput) {
                console.error('Season date inputs not found');
                alert('Error: Season date inputs not found. Please check the page structure.');
                return;
            }

            try {
                const response = await fetch('/api/admin/season-dates');
                if (response.ok) {
                    const data = await response.json();
                    startDateInput.value = data.startDate.split('T')[0];
                    endDateInput.value = data.endDate.split('T')[0];
                    adminControls.style.display = 'none';
                    adminSeasonDates.style.display = 'block';
                } else {
                    const errorData = await response.json();
                    console.error('Error fetching season dates:', errorData);
                    alert(`Error fetching season dates: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error fetching season dates:', error);
                alert('Error fetching season dates. Check the console for details.');
            }
        });
    }

    if (saveAnnouncementBtn) {
        saveAnnouncementBtn.addEventListener('click', async () => {
            const adminPassword = adminPasswordInput.dataset.password;
            const announcementInput = document.getElementById('announcement-input');
            if (!announcementInput) {
                console.error('announcementInput element not found');
                alert('Error: Announcement input field not found. Please check the page structure.');
                return;
            }

            const text = announcementInput.value.trim();

            if (!text) {
                alert('Announcement text cannot be empty!');
                return;
            }

            try {
                const response = await fetch('/api/admin/update-announcement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword, text })
                });

                if (response.ok) {
                    alert('Announcement updated successfully!');
                    fetchAnnouncement();
                    adminAnnouncement.style.display = 'none';
                    adminControls.style.display = 'block';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error updating announcement:', error);
                alert('Error updating announcement. Check the console for details.');
            }
        });
    }

    if (saveSeasonDatesBtn) {
        saveSeasonDatesBtn.addEventListener('click', async () => {
            const adminPassword = adminPasswordInput.dataset.password;
            const startDateInput = document.getElementById('season-start-date');
            const endDateInput = document.getElementById('season-end-date');
            if (!startDateInput || !endDateInput) {
                console.error('Season date inputs not found');
                alert('Error: Season date inputs not found. Please check the page structure.');
                return;
            }

            const startDate = startDateInput.value;
            const endDate = endDateInput.value;

            if (!startDate || !endDate) {
                alert('Please select both start and end dates!');
                return;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start >= end) {
                alert('End date must be after start date!');
                return;
            }

            try {
                const response = await fetch('/api/admin/update-season-dates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        adminPassword, 
                        startDate: `${startDate}T00:00:00-05:00`, 
                        endDate: `${endDate}T00:00:00-05:00` 
                    })
                });

                if (response.ok) {
                    alert('Season dates updated successfully!');
                    fetchSeasonDates();
                    adminSeasonDates.style.display = 'none';
                    adminControls.style.display = 'block';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error updating season dates:', error);
                alert('Error updating season dates. Check the console for details.');
            }
        });
    }

    if (backToControlsBtn) {
        backToControlsBtn.addEventListener('click', () => {
            adminUsers.style.display = 'none';
            adminControls.style.display = 'block';
        });
    }

    if (backToControlsFromAnnouncementBtn) {
        backToControlsFromAnnouncementBtn.addEventListener('click', () => {
            adminAnnouncement.style.display = 'none';
            adminControls.style.display = 'block';
        });
    }

    if (backToControlsFromSeasonDatesBtn) {
        backToControlsFromSeasonDatesBtn.addEventListener('click', () => {
            adminSeasonDates.style.display = 'none';
            adminControls.style.display = 'block';
        });
    }

    // Handle sign-up and sign-in form toggling
    const showSignupBtn = document.getElementById('show-signup-btn');
    const showSigninBtn = document.getElementById('show-signin-btn');
    const signupFormContainer = document.getElementById('signup-form-container');
    const signinFormContainer = document.getElementById('signin-form-container');

    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', () => {
            signupFormContainer.style.display = 'block';
            signinFormContainer.style.display = 'none';
        });
    }

    if (showSigninBtn) {
        showSigninBtn.addEventListener('click', () => {
            signupFormContainer.style.display = 'none';
            signinFormContainer.style.display = 'block';
        });
    }

    // Handle sign-up form submission
    const signupForm = document.getElementById('signup-form');
    const signupFeedback = document.getElementById('signup-feedback');
    const nextStepsSection = document.getElementById('next-steps-section');
    const authSection = document.getElementById('auth-section');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const xUsername = document.getElementById('signup-x-username').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const hederaWallet = document.getElementById('signup-hedera-wallet').value.trim();

            // Auto-prepend @ if missing
            let normalizedXUsername = xUsername;
            if (!normalizedXUsername.startsWith('@')) {
                normalizedXUsername = '@' + normalizedXUsername;
                document.getElementById('signup-x-username').value = normalizedXUsername;
            }

            // Validate X username
            const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
            if (!xUsernameRegex.test(normalizedXUsername)) {
                signupFeedback.style.display = 'block';
                signupFeedback.style.color = '#d9534f';
                signupFeedback.textContent = 'Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).';
                return;
            }

            // Validate password
            if (password.length < 8) {
                signupFeedback.style.display = 'block';
                signupFeedback.style.color = '#d9534f';
                signupFeedback.textContent = 'Password must be at least 8 characters long!';
                return;
            }

            // Validate Hedera wallet address if provided
            let walletAddress = hederaWallet || 'N/A';
            if (hederaWallet) {
                const walletRegex = /^0\.0\.\d+$/;
                if (!walletRegex.test(hederaWallet)) {
                    signupFeedback.style.display = 'block';
                    signupFeedback.style.color = '#d9534f';
                    signupFeedback.textContent = 'Invalid Hedera wallet address! It must start with 0.0. followed by numbers (e.g., 0.0.12345).';
                    return;
                }
                walletAddress = hederaWallet;
            }

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xUsername: normalizedXUsername, password, hederaWallet: walletAddress }),
                    credentials: 'include'
                });

                if (response.ok) {
                    signupFeedback.style.display = 'block';
                    signupFeedback.style.color = '#4a7c59';
                    signupFeedback.textContent = `Welcome ${normalizedXUsername}! Start posting #LazyLegends to climb the leaderboard!`;
                    signupForm.reset();
                    authSection.style.display = 'none';
                    nextStepsSection.style.display = 'block';
                    fetchLeaderboard();
                    fetchSeasonWinners();
                } else {
                    const errorData = await response.json();
                    signupFeedback.style.display = 'block';
                    signupFeedback.style.color = '#d9534f';
                    signupFeedback.textContent = `Error: ${errorData.error || 'Unknown error'}`;
                }
            } catch (error) {
                console.error('Error during sign-up:', error);
                signupFeedback.style.display = 'block';
                signupFeedback.style.color = '#d9534f';
                signupFeedback.textContent = 'Error during sign-up. Check the console for details.';
            }
        });
    }

    // Handle sign-in form submission
    const signinForm = document.getElementById('signin-form');
    const signinFeedback = document.getElementById('signin-feedback');

    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const xUsername = document.getElementById('signin-x-username').value.trim();
            const password = document.getElementById('signin-password').value.trim();

            // Auto-prepend @ if missing
            let normalizedXUsername = xUsername;
            if (!normalizedXUsername.startsWith('@')) {
                normalizedXUsername = '@' + normalizedXUsername;
                document.getElementById('signin-x-username').value = normalizedXUsername;
            }

            // Validate X username
            const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
            if (!xUsernameRegex.test(normalizedXUsername)) {
                signinFeedback.style.display = 'block';
                signinFeedback.style.color = '#d9534f';
                signinFeedback.textContent = 'Invalid X username! It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).';
                return;
            }

            // Validate password
            if (!password) {
                signinFeedback.style.display = 'block';
                signinFeedback.style.color = '#d9534f';
                signinFeedback.textContent = 'Password is required!';
                return;
            }

            try {
                const response = await fetch('/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xUsername: normalizedXUsername, password }),
                    credentials: 'include'
                });

                if (response.ok) {
                    signinFeedback.style.display = 'block';
                    signinFeedback.style.color = '#4a7c59';
                    signinFeedback.textContent = `Welcome back ${normalizedXUsername}!`;
                    signinForm.reset();
                    authSection.style.display = 'none';
                    nextStepsSection.style.display = 'block';
                    fetchLeaderboard();
                    fetchSeasonWinners();
                } else {
                    const errorData = await response.json();
                    signinFeedback.style.display = 'block';
                    signinFeedback.style.color = '#d9534f';
                    signinFeedback.textContent = `Error: ${errorData.error || 'Unknown error'}`;
                }
            } catch (error) {
                console.error('Error during sign-in:', error);
                signinFeedback.style.display = 'block';
                signinFeedback.style.color = '#d9534f';
                signinFeedback.textContent = 'Error during sign-in. Check the console for details.';
            }
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

    // Handle "View Profile" button in Next Steps
    const viewProfileBtn = document.getElementById('view-profile-btn');
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/whoami', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    const username = data.xUsername;
                    // Show the profile section as a pop-up
                    document.querySelectorAll('section').forEach(section => section.style.display = 'none');
                    const profileSection = document.getElementById('profile-section');
                    profileSection.style.display = 'block';

                    // Populate the profile section with user data
                    document.getElementById('profile-x-username').textContent = data.xUsername;
                    document.getElementById('profile-hedera-wallet').textContent = data.hederaWallet || 'N/A';
                    document.getElementById('profile-slo-mo-points').textContent = data.sloMoPoints || 0;

                    const profilePhoto = document.getElementById('profile-photo');
                    if (data.profilePhoto) {
                        profilePhoto.src = data.profilePhoto;
                        profilePhoto.style.display = 'block';
                    } else {
                        profilePhoto.style.display = 'none';
                    }
                } else {
                    alert('Please sign in to view your profile.');
                    document.querySelectorAll('section').forEach(section => section.style.display = 'block');
                    const authSection = document.getElementById('auth-section');
                    authSection.style.display = 'block';
                    const nextStepsSection = document.getElementById('next-steps-section');
                    nextStepsSection.style.display = 'none';
                    hamburgerMenu.classList.remove('active');
                }
            } catch (error) {
                console.error('Error checking user session:', error);
                alert('Error checking user session. Please sign in again.');
            }
        });
    }

    // Handle "Back to Home" button in Profile Section
    const backToHomeFromProfileBtn = document.getElementById('back-to-home-from-profile-btn');
    if (backToHomeFromProfileBtn) {
        backToHomeFromProfileBtn.addEventListener('click', () => {
            document.querySelectorAll('section').forEach(section => section.style.display = 'block');
            const profileSection = document.getElementById('profile-section');
            profileSection.style.display = 'none';
        });
    }

    // Handle profile photo upload
    const uploadPhotoForm = document.getElementById('upload-photo-form');
    const uploadFeedback = document.getElementById('upload-feedback');

    if (uploadPhotoForm) {
        uploadPhotoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const photoInput = document.getElementById('profile-photo-input');
            if (!photoInput.files || photoInput.files.length === 0) {
                uploadFeedback.style.display = 'block';
                uploadFeedback.style.color = '#d9534f';
                uploadFeedback.textContent = 'Please select a photo to upload.';
                return;
            }

            const formData = new FormData();
            formData.append('photo', photoInput.files[0]);

            try {
                const response = await fetch('/api/upload-photo', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const profilePhoto = document.getElementById('profile-photo');
                    profilePhoto.src = data.photoUrl;
                    profilePhoto.style.display = 'block';
                    uploadFeedback.style.display = 'block';
                    uploadFeedback.style.color = '#4a7c59';
                    uploadFeedback.textContent = 'Profile photo uploaded successfully!';
                    photoInput.value = ''; // Clear the file input
                    fetchLeaderboard(); // Refresh leaderboard to show thumbnail
                } else {
                    const errorData = await response.json();
                    uploadFeedback.style.display = 'block';
                    uploadFeedback.style.color = '#d9534f';
                    uploadFeedback.textContent = `Error: ${errorData.error || 'Unknown error'}`;
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                uploadFeedback.style.display = 'block';
                uploadFeedback.style.color = '#d9534f';
                uploadFeedback.textContent = 'Error uploading photo. Check the console for details.';
            }
        });
    }

    // Handle sign-out
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/signout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    alert('Signed out successfully!');
                    window.location.href = '/';
                } else {
                    alert('Error signing out. Please try again.');
                }
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Check the console for details.');
            }
        });
    }

    // Handle account deletion
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                return;
            }

            try {
                const response = await fetch('/api/delete-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    alert('Account deleted successfully.');
                    window.location.href = '/';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                alert('Error deleting account. Check the console for details.');
            }
        });
    }

    async function fetchAnnouncement() {
        try {
            const response = await fetch('/api/admin/announcement', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const announcementText = document.getElementById('announcement-text');
                if (announcementText) {
                    announcementText.textContent = data.text;
                } else {
                    console.error('announcement-text element not found');
                }
            } else {
                console.error('Error fetching announcement:', await response.json());
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
        }
    }

    async function fetchLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard', {
                credentials: 'include'
            });
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
                const thumbnail = entry.profilePhoto ? `<img src="${entry.profilePhoto}" alt="${entry.xUsername}'s photo" class="profile-thumbnail">` : '';
                row.innerHTML = `
                    <td>${rankDisplay}</td>
                    <td>${thumbnail}${entry.xUsername}</td>
                    <td>${entry.sloMoPoints}</td>
                `;
                leaderboardBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    }

    async function fetchSeasonWinners() {
        try {
            // First, fetch the logged-in user's xUsername
            const whoamiResponse = await fetch('/api/whoami', {
                credentials: 'include'
            });
            let xUsername = null;
            if (whoamiResponse.ok) {
                const whoamiData = await whoamiResponse.json();
                xUsername = whoamiData.xUsername;
            } else {
                console.log('User not logged in:', await whoamiResponse.json());
            }

            const response = await fetch('/api/season-winners', {
                credentials: 'include'
            });
            const seasonWinnersDiv = document.getElementById('season-winners');

            if (response.ok) {
                const data = await response.json();
                seasonWinnersDiv.innerHTML = '';

                if (data.winners.length === 0) {
                    seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
                } else {
                    // Sort winners by rank in ascending order (Rank 1 first)
                    data.winners.sort((a, b) => a.rank - b.rank);
                    data.winners.forEach(winner => {
                        const winnerText = `Rank ${winner.rank}: ${winner.xUsername} - ${winner.sloMoPoints} SloMo Points`;
                        const p = document.createElement('p');
                        p.textContent = winnerText;
                        seasonWinnersDiv.appendChild(p);
                    });
                }
            } else {
                const errorData = await response.json();
                if (errorData.error === 'No previous season found') {
                    seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
                } else {
                    console.error('Error fetching season winners:', errorData);
                }
            }
        } catch (error) {
            console.error('Error fetching season winners:', error);
            const seasonWinnersDiv = document.getElementById('season-winners');
            seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
        }
    }
});
