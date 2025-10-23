// Import tools needed for Firebase Functions and fetching data
const functions = require('firebase-functions');
const fetch = require('node-fetch');

// 1. The LeetCode API is a GraphQL endpoint. We use this URL.
const LEETCODE_API = 'https://leetcode.com/graphql';

// 2. Define the main function that runs when your frontend calls the server
exports.getLeetCodeActivity = functions.https.onRequest(async (req, res) => {

    // **CRUCIAL STEP: Handle CORS**
    // This allows your frontend (which is running locally or on a different domain) 
    // to talk to your Cloud Function securely.
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    // 3. Get the LeetCode handle (username) from the web request (e.g., /?handle=UserA)
    const handle = req.query.handle;
    if (!handle) {
        return res.status(400).json({ error: 'LeetCode handle is missing.' });
    }

    // 4. This is the request (query) we send to LeetCode to get the stats
    const graphqlQuery = `
        query getUserStats($username: String!) {
            matchedUser(username: $username) {
                submitStats {
                    acSubmissionNum { difficulty count }
                }
                profile { ranking }
            }
        }`;
    
    // 5. Package the query and the handle into the request body
    const variables = { username: handle };

    try {
        // 6. Send the request to LeetCode
        const apiResponse = await fetch(LEETCODE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: graphqlQuery, variables })
        });
        
        // Error check if LeetCode gave a bad response
        if (!apiResponse.ok) {
            throw new Error(`LeetCode API failed with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        const matchedUser = data.data.matchedUser;
        
        if (!matchedUser) {
            return res.status(404).json({ error: `LeetCode user ${handle} not found.` });
        }

        // 7. Process the raw LeetCode data into the simple structure your frontend expects
        const breakdown = { easy: 0, medium: 0, hard: 0 };
        matchedUser.submitStats.acSubmissionNum.forEach(stat => {
            breakdown[stat.difficulty.toLowerCase()] = stat.count;
        });

        const totalSolved = breakdown.easy + breakdown.medium + breakdown.hard;
        const contestRating = matchedUser.profile.ranking || 'Unrated'; 
        
        // 8. Send the clean data back to your frontend
        res.status(200).json({
            totalSolved,
            difficultyBreakdown: breakdown,
            contestRating,
            recentSubmission: { title: "Requires another query", status: "N/A" } // Keeping it simple for now
        });

    } catch (error) {
        console.error('Error fetching LeetCode data:', error);
        res.status(500).json({ error: 'Internal server error. Check logs.' });
    }
});