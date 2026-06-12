// Mock authentication service using localStorage
export interface MockUser {
  id: string;
  name: string;
  email: string;
  college: string;
  university: string;
  year: number;
  createdAt: string;
}

export interface MockSession {
  token: string;
  user: MockUser;
}

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAuthService = {
  register: async (data: {
    name: string;
    email: string;
    password: string;
    college: string;
    university: string;
    year: number;
  }): Promise<MockSession> => {
    await delay(800);
    
    const existingUsers = JSON.parse(localStorage.getItem('medicology_users') || '{}');
    if (existingUsers[data.email]) {
      throw new Error('Email already registered');
    }

    const user: MockUser = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      email: data.email,
      college: data.college,
      university: data.university,
      year: data.year,
      createdAt: new Date().toISOString(),
    };

    const token = btoa(JSON.stringify({ user, timestamp: Date.now() }));
    
    existingUsers[data.email] = { password: data.password, user };
    localStorage.setItem('medicology_users', JSON.stringify(existingUsers));
    localStorage.setItem('medicology_session', JSON.stringify({ token, user }));

    return { token, user };
  },

  login: async (email: string, password: string): Promise<MockSession> => {
    await delay(800);
    
    const users = JSON.parse(localStorage.getItem('medicology_users') || '{}');
    const userData = users[email];

    if (!userData || userData.password !== password) {
      throw new Error('Invalid email or password');
    }

    const token = btoa(JSON.stringify({ user: userData.user, timestamp: Date.now() }));
    localStorage.setItem('medicology_session', JSON.stringify({ token, user: userData.user }));

    return { token, user: userData.user };
  },

  logout: () => {
    localStorage.removeItem('medicology_session');
  },

  getSession: (): MockSession | null => {
    const session = localStorage.getItem('medicology_session');
    return session ? JSON.parse(session) : null;
  },

  isLoggedIn: (): boolean => {
    return !!localStorage.getItem('medicology_session');
  },
};
