import React, { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/user', {
      credentials: 'include',
    })
      .then(res => {
        if (res.status === 401) {
          window.location.href = 'http://localhost:3000/auth/login';
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) setUser(data);
      });
  }, []);

  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h1>Welcome {user.username}</h1>
      <p>Your role ID is: {user.roleId}</p>
      <a href="http://localhost:3000/logout">Logout</a>
    </div>
  );
}

export default App;
