async function fetchSeasonWinners() {
    try {
        // First, fetch the logged-in user's xUsername
        const whoamiResponse = await fetch('/api/whoami');
        let xUsername = null;
        if (whoamiResponse.ok) {
            const whoamiData = await whoamiResponse.json();
            xUsername = whoamiData.xUsername;
        }

        const response = await fetch('/api/season-winners');
        const seasonWinnersDiv = document.getElementById('season-winners');
        const claimRewardsDiv = document.getElementById('claim-rewards');
        const rewardDetailsP = document.getElementById('reward-details');

        if (response.ok) {
            const data = await response.json();
            seasonWinnersDiv.innerHTML = '';

            if (data.winners.length === 0) {
                seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
            } else {
                data.winners.forEach(winner => {
                    const status = winner.claimed ? ' (Claimed)' : ' (Not Claimed)';
                    const winnerText = `Rank ${winner.rank}: ${winner.xUsername} - ${winner.rewardAmount} $SLOTH${status}`;
                    const p = document.createElement('p');
                    p.textContent = winnerText;
                    seasonWinnersDiv.appendChild(p);
                });

                // Check if the logged-in user is eligible to claim rewards
                if (xUsername) {
                    const userWinner = data.winners.find(winner => winner.xUsername === xUsername);
                    if (userWinner && !userWinner.claimed) {
                        claimRewardsDiv.style.display = 'block';
                        rewardDetailsP.textContent = `Rank ${userWinner.rank}: You won ${userWinner.rewardAmount} $SLOTH!`;
                    } else {
                        claimRewardsDiv.style.display = 'none';
                    }
                } else {
                    claimRewardsDiv.style.display = 'none';
                }
            }
        } else {
            const errorData = await response.json();
            if (errorData.error === 'No previous season found') {
                seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
            } else {
                console.error('Error fetching season winners:', errorData);
            }
            claimRewardsDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching season winners:', error);
        const seasonWinnersDiv = document.getElementById('season-winners');
        const claimRewardsDiv = document.getElementById('claim-rewards');
        seasonWinnersDiv.innerHTML = '<p>No previous seasons yet. Keep posting to win!</p>';
        claimRewardsDiv.style.display = 'none';
    }
}
