import React, { useEffect, useState } from 'react';
import { AuthService } from './services/firebase';
import LoginScreen from './components/LoginScreen'; // Màn hình đăng nhập
import MainDashboard from './components/MainDashboard'; // Giao diện chính

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Theo dõi trạng thái đăng nhập từ Firebase
    const unsubscribe = AuthService.onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>Đang tải ứng dụng...</div>;

  // Nếu chưa đăng nhập, hiện màn hình Login. Nếu rồi, hiện Dashboard riêng.
  return user ? <MainDashboard user={user} /> : <LoginScreen />;
}

export default App;
