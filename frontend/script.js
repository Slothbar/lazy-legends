document.addEventListener('DOMContentLoaded', async () => {
    // Fetch WalletConnect project ID from the backend
    let walletConnectProjectId = '';
    try {
        const response = await fetch('/api/walletconnect-config');
        const data = await response.json();
        walletConnectProjectId = data.projectId;
        console.log('WalletConnect Project ID:', walletConnectProjectId);
    } catch (error) {
        console.error('Error fetching WalletConnect project ID:', error);
        alert('Error initializing WalletConnect. Please try again later.');
        return;
    }

    // Check if UniversalProvider is available
    console.log('UniversalProvider:', window.UniversalProvider);

    // Initialize WalletConnect Universal Provider
    let provider;
    try {
        provider = await window.UniversalProvider.init({
            projectId: walletConnectProjectId,
            metadata: {
                name: 'Lazy Legends',
                description: 'A Chill2Earn game on Hedera',
                url: 'https://lazylegendscoin.com',
                icons: ['https://lazylegendscoin.com/icon.png']
            }
        });
        console.log('WalletConnect Universal Provider initialized:', provider);
    } catch (error) {
        console.error('Error initializing WalletConnect Universal Provider:', error);
        alert('Error initializing WalletConnect. Check the console for details.');
        return;
    }

    let hederaAccountId = null;

    // Load leaderboard on page load
    fetchLeaderboard();

    // Check if user is already authenticated
    checkUserSession();

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
            adminLogin.style.display = 'none';
            adminControls.style.display = 'block';
            adminPasswordInput.dataset.password = password;
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

    // Handle wallet connect
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const viewProfileBtn = document.getElementById('view-profile-btn');
    const disconnectWalletBtn = document.getElementById('disconnect-wallet-btn');
    const walletConnectSection = document.getElementById('wallet-connect-section');
    const signupSection = document.getElementById('signup-section');
    const profileSection = document.getElementById('profile-section');
    const signupForm = document.getElementById('signup-form');
    const backToHomeFromProfileBtn = document.getElementById('back-to-home-from-profile-btn');

    console.log('Connect Wallet Button:', connectWalletBtn);

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async () => {
            console.log('Connect Wallet button clicked');
            try {
                console.log('Initiating WalletConnect connection...');
                await provider.connect({
                    namespaces: {
                        hedera: {
                            methods: ['hedera_sign'],
                            chains: ['hedera:mainnet'],
                            events: ['chainChanged', 'accountsChanged']
                        }
                    }
                });

                console.log('WalletConnect session established');
                const accounts = provider.accounts;
                hederaAccountId = accounts[0];
                console.log('Hedera Account ID:', hederaAccountId);

                // Log in with the Hedera account ID
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hederaAccountId })
                });

                const data = await response.json();
                if (response.ok) {
                    if (data.needsSignup) {
                        document.querySelectorAll('section').forEach(section => section.style.display = 'none');
                        signupSection.style.display = 'block';
                    } else {
                        showProfile(data.user);
                    }
                } else {
                    alert(`Error: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error connecting wallet:', error);
                alert('Error connecting wallet. Check the console for details.');
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const xUsername = document.getElementById('signup-x-username').value.trim();

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xUsername })
                });

                if (response.ok) {
                    alert('X account linked successfully!');
                    const userResponse = await fetch('/api/user');
                    const userData = await userResponse.json();
                    showProfile(userData);
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error linking X account:', error);
                alert('Error linking X account. Check the console for details.');
            }
        });
    }

    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/user');
                const data = await response.json();
                if (response.ok) {
                    showProfile(data);
                } else {
                    alert(`Error: ${data.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                alert('Error fetching profile. Check the console for details.');
            }
        });
    }

    if (disconnectWalletBtn) {
        disconnectWalletBtn.addEventListener('click', async () => {
            try {
                await provider.disconnect();
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    hederaAccountId = null;
                    connectWalletBtn.style.display = 'block';
                    viewProfileBtn.style.display = 'none';
                    disconnectWalletBtn.style.display = 'none';
                    document.querySelectorAll('section').forEach(section => section.style.display = 'block');
                    profileSection.style.display = 'none';
                    fetchLeaderboard();
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error disconnecting wallet:', error);
                alert('Error disconnecting wallet. Check the console for details.');
            }
        });
    }

    if (backToHomeFromProfileBtn) {
        backToHomeFromProfileBtn.addEventListener('click', () => {
            document.querySelectorAll('section').forEach(section => section.style.display = 'block');
            profileSection.style.display = 'none';
        });
    }

    async function checkUserSession() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const data = await response.json();
                hederaAccountId = data.hederaAccountId;
                connectWalletBtn.style.display = 'none';
                viewProfileBtn.style.display = 'block';
                disconnectWalletBtn.style.display = 'block';
                if (data.needsSignup) {
                    document.querySelectorAll('section').forEach(section => section.style.display = 'none');
                    signupSection.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error checking user session:', error);
        }
    }

    async function showProfile(user) {
        document.querySelectorAll('section').forEach(section => section.style.display = 'none');
        profileSection.style.display = 'block';

        document.getElementById('profile-hedera-account').textContent = user.hederaAccountId.slice(0, 6) + '...';
        document.getElementById('profile-x-username').textContent = user.xUsername || 'Not linked';
        document.getElementById('profile-slo-mo-points').textContent = user.sloMoPoints || 0;

        // Fetch leaderboard to determine rank
        const leaderboardResponse = await fetch('/api/leaderboard');
        const leaderboard = await leaderboardResponse.json();
        const userRank = leaderboard.findIndex(entry => entry.xUsername === user.xUsername) + 1;
        document.getElementById('profile-leaderboard-rank').textContent = userRank > 0 ? userRank : 'Not ranked';
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
