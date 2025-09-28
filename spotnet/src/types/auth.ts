export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}
