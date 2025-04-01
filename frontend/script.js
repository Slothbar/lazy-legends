document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();

    let hederaWallet = null;
    let hashconnect = null;

    const connectWallet = async () => {
        try {
            // Initialize HashConnect
            hashconnect = new window.HashConnect(true);
            const appMetadata = {
                name: "Lazy Legends",
                description: "A Chill2Earn game on Hedera",
                icon: "https://i.ibb.co/7W8z8Qz/sloth-icon.png",
                url: "https://lazylegendscoin.com"
            };

            const initData = await hashconnect.init(appMetadata, "mainnet", false);
            console.log("HashConnect initialized:", initData);

            // Show pairing string to user
            alert(`Please connect your HashPack wallet using this pairing string: ${initData.pairingString}`);

            // Wait for pairing
            hashconnect.pairingEvent.once((pairingData) => {
                console.log("Paired with wallet:", pairingData);
                hederaWallet = pairingData.accountIds[0];
                document.getElementById('hedera-wallet').value = hederaWallet;
                document.getElementById('hedera-wallet').disabled = true;
                alert(`Connected wallet: ${hederaWallet}`);
            });

            await hashconnect.connectToLocalWallet(initData.pairingString);
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Error connecting HashPack wallet. Check the console for details.');
        }
    };

    document.getElementById('connect-wallet-btn').addEventListener('click', connectWallet);

    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const xUsername = document.getElementById('x-username').value;
        const hederaWalletInput = document.getElementById('hedera-wallet').value;

        if (!hederaWallet) {
            alert('Please connect your HashPack wallet first!');
            return;
        }

        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xUsername, hederaWallet: hederaWalletInput })
        });

        if (response.ok) {
            alert('Profile saved successfully!');
            profileForm.reset();
            hederaWallet = null;
            document.getElementById('hedera-wallet').disabled = false;
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
