const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messages = document.getElementById('messages');
    const onlineUsers = document.getElementById('online-users');
    const matchesList = document.getElementById('matches-list');
    const matchTypeSelect = document.getElementById('match-type');
    const searchMatchesButton = document.getElementById('search-matches');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterButton = document.getElementById('show-register');
    const showLoginButton = document.getElementById('show-login');
    const profileForm = document.getElementById('profile-form');
    const profilePassword = document.getElementById('profile-password');
    const profileAge = document.getElementById('profile-age');
    const profileGender = document.getElementById('profile-gender');
    const profileInterests = document.getElementById('profile-interests');
    const profilePicture = document.getElementById('profile-picture');
    const welcomeHeader = document.getElementById('welcome-header');
    const userMessages = document.getElementById('user-messages');
    const userFriends = document.getElementById('user-friends');
    const profileViewers = document.getElementById('profile-viewers');
    const viewMessagesButton = document.getElementById('view-messages');
    const viewFriendsButton = document.getElementById('view-friends');
    const viewProfileViewersButton = document.getElementById('view-profile-viewers');

    // Toggle between login and register forms
    showRegisterButton.addEventListener('click', () => {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').styles
    });

    showLoginButton.addEventListener('click', () => {
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
    });

    // Handle login form submission
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const username = usernameInput.value;
        socket.emit('new user', username);
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('chat-room').style.display = 'block';
        welcomeHeader.style.display = 'none';
        fetchMatches(username);
        fetchUserSections(username);
    });

  // Handle registration form submission
registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);

    // Log form data to console for debugging
    for (let [key, value] of formData.entries()) {
        console.log(key, value);
    }

    fetch('/register', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            console.log('Registration successful');
            document.getElementById('register-section').style.display = 'none';
            document.getElementById('login-section').style.display = 'block';
        } else {
            console.log('Registration failed');
            alert('Registration failed. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
});
    // Existing code ...

// Handle friend requests
function sendFriendRequest(username) {
    fetch('/send-friend-request', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to: username, from: usernameInput.value })
    })
    .then(response => {
        if (response.ok) {
            alert('Friend request sent!');
        } else {
            alert('Failed to send friend request.');
        }
    });
}

// Handle search bar
document.getElementById('search-button').addEventListener('click', () => {
    const searchQuery = document.getElementById('search-bar').value;
    fetch(`/search-users?query=${searchQuery}`)
    .then(response => response.json())
    .then(users => {
        matchesList.innerHTML = '';
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.textContent = user.username;
            const friendRequestButton = document.createElement('button');
            friendRequestButton.textContent = 'Send Friend Request';
            friendRequestButton.addEventListener('click', () => sendFriendRequest(user.username));
            userElement.appendChild(friendRequestButton);
            matchesList.appendChild(userElement);
        });
    });
});

// Existing code...

    // Handle sending messages
    sendButton.addEventListener('click', () => {
        const message = {
            username: usernameInput.value,
            text: messageInput.value
        };
        socket.emit('chat message', message);
        messageInput.value = '';
    });

    socket.on('chat history', (history) => {
        history.forEach((msg) => {
            const messageElement = document.createElement('div');
            messageElement.textContent = `${msg.timestamp} - ${msg.username}: ${msg.message}`;
            messages.appendChild(messageElement);
        });
    });

    socket.on('chat message', (msg) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${msg.timestamp} - ${msg.username}: ${msg.text}`;
        messages.appendChild(messageElement);
    });

    socket.on('user list', (users) => {
        onlineUsers.innerHTML = '';
        users.forEach((user) => {
            const userElement = document.createElement('div');
            userElement.textContent = user;
            userElement.addEventListener('click', () => {
                const privateMessage = prompt(`Send a private message to ${user}:`);
                if (privateMessage) {
                    socket.emit('private message', { to: user, from: usernameInput.value, text: privateMessage });
                }
            });
            onlineUsers.appendChild(userElement);
        });
    });

    socket.on('private message', (msg) => {
        alert(`Private message from ${msg.from}: ${msg.text}`);
    });

    // Function to fetch and display matches
    function fetchMatches(username) {
        const matchType = matchTypeSelect.value;
        fetch('/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, matchType: matchType })
        })
        .then(response => response.json())
        .then(matches => {
            matchesList.innerHTML = '';
            matches.forEach((match) => {
                const matchElement = document.createElement('div');
                matchElement.textContent = match.username;
                matchElement.addEventListener('click', () => {
                    const privateMessage = prompt(`Send a private message to ${match.username}:`);
                    if (privateMessage) {
                        socket.emit('private message', { to: match.username, from: username, text: privateMessage });
                    }
                });
                matchesList.appendChild(matchElement);
            });
        });
    }

    // Event listener for search matches button
    searchMatchesButton.addEventListener('click', () => {
        const username = usernameInput.value;
        fetchMatches(username);
    });

    // Event listener for profile form
    profileForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const profileData = new FormData(profileForm);
        fetch('/profile', {
            method: 'POST',
            body: profileData
        })
        .then(response => {
            if (response.ok) {
                alert('Profile updated successfully!');
                document.getElementById('profile').style.display = 'none';
            } else {
                alert('Failed to update profile.');
            }
        });
    });

    // Function to fetch and display user sections
    function fetchUserSections(username) {
        fetch(`/user-sections?username=${username}`)
        .then(response => response.json())
        .then(data => {
            userMessages.innerHTML = '';
            data.messages.forEach((message) => {
                const messageElement = document.createElement('div');
                messageElement.textContent = message;
                userMessages.appendChild(messageElement);
            });

            userFriends.innerHTML = '';
            data.friends.forEach((friend) => {
                const friendElement = document.createElement('div');
                friendElement.textContent = friend;
                userFriends.appendChild(friendElement);
            });

            profileViewers.innerHTML = '';
            data.viewers.forEach((viewer) => {
                const viewerElement = document.createElement('div');
                viewerElement.textContent = viewer;
                profileViewers.appendChild(viewerElement);
            });
        });
    }

    // Event listeners for user sections buttons
    viewMessagesButton.addEventListener('click', () => {
        userMessages.style.display = 'block';
        userFriends.style.display = 'none';
        profileViewers.style.display = 'none';
    });

    viewFriendsButton.addEventListener('click', () => {
        userMessages.style.display = 'none';
        userFriends.style.display = 'block';
        profileViewers.style.display = 'none';
    });

    viewProfileViewersButton.addEventListener('click', () => {
        userMessages.style.display = 'none';
        userFriends.style.display = 'none';
        profileViewers.style.display = 'block';
    });
});
document.addEventListener('DOMContentLoaded', () => {
    // Existing event listeners and functions...

    // Function to display the unread and all messages interface
    function displayMessagesInterface(messagesData) {
        // Hide other sections
        document.getElementById('user-messages-interface').style.display = 'block';
        document.getElementById('user-friends').style.display = 'none';
        document.getElementById('profile-viewers').style.display = 'none';

        const unreadMessages = document.getElementById('unread-messages');
        const allMessages = document.getElementById('all-messages');

        // Clear existing messages
        unreadMessages.innerHTML = '';
        allMessages.innerHTML = '';

        // Populate messages
        messagesData.unread.forEach((message) => {
            const messageElement = document.createElement('div');
            messageElement.textContent = message;
            unreadMessages.appendChild(messageElement);
        });

        messagesData.all.forEach((message) => {
            const messageElement = document.createElement('div');
            messageElement.textContent = message;
            allMessages.appendChild(messageElement);
        });
    }

    // Event listener for user messages button
    viewMessagesButton.addEventListener('click', () => {
        fetch(`/user-messages?username=${usernameInput.value}`)
        .then(response => response.json())
        .then(data => {
            displayMessagesInterface(data);
        });
    });

    // Event listeners for unread and all messages buttons
    document.getElementById('view-unread-messages').addEventListener('click', () => {
        document.getElementById('unread-messages').style.display = 'block';
        document.getElementById('all-messages').style.display = 'none';
    });

    document.getElementById('view-all-messages').addEventListener('click', () => {
        document.getElementById('unread-messages').style.display = 'none';
        document.getElementById('all-messages').style.display = 'block';
    });
});
document.getElementById('singles-room').addEventListener('click', () => {
    const username = usernameInput.value;
    fetchMatchesByCategory(username, 'singles-room');
});

document.getElementById('searching-relationship').addEventListener('click', () => {
    const username = usernameInput.value;
    fetchMatchesByCategory(username, 'searching-relationship');
});

function fetchMatchesByCategory(username, category) {
    fetch('/match', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, matchType: category })
    })
    .then(response => response.json())
    .then(matches => {
        matchesList.innerHTML = '';
        matches.forEach((match) => {
            const matchElement = document.createElement('div');
            matchElement.textContent = match.username;
            matchElement.addEventListener('click', () => {
                const privateMessage = prompt(`Send a private message to ${match.username}:`);
                if (privateMessage) {
                    socket.emit('private message', { to: match.username, from: username, text: privateMessage });
                }
            });
            matchesList.appendChild(matchElement);
        });
    });
}
function displayMessagesInterface(messagesData) {
    document.getElementById('user-messages-interface').style.display = 'block';
    document.getElementById('user-friends').style.display = 'none';
    document.getElementById('profile-viewers').style.display = 'none';

    const unreadMessages = document.getElementById('unread-messages');
    const allMessages = document.getElementById('all-messages');

    unreadMessages.innerHTML = '';
    allMessages.innerHTML = '';

    messagesData.unread.forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        unreadMessages.appendChild(messageElement);
    });

    messagesData.all.forEach((message) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        allMessages.appendChild(messageElement);
    });
}

viewMessagesButton.addEventListener('click', () => {
    fetch(`/user-messages?username=${usernameInput.value}`)
    .then(response => response.json())
    .then(data => {
        displayMessagesInterface(data);
    });
});

document.getElementById('view-unread-messages').addEventListener('click', () => {
    document.getElementById('unread-messages').style.display = 'block';
    document.getElementById('all-messages').style.display = 'none';
});

document.getElementById('view-all-messages').addEventListener('click', () => {
    document.getElementById('unread-messages').style.display = 'none';
    document.getElementById('all-messages').style.display = 'block';
});
"scripts": {
  "build": "node build.js",
  "deploy": "gh-pages -d build"
}