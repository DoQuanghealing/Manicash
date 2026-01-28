import React, { useEffect, useState } from 'react';
import { AuthService } from './services/firebase';
import LoginScreen from './components/LoginScreen'; 
import MainDashboard from './components/MainDashboard';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Kiểm tra xem Firebase đã được nạp API Key chưa
    if (!AuthService.isConfigured()) {
      setError("Cấu hình Firebase thiếu API Key. Vui lòng kiểm tra Vercel Environment Variables.");
      setLoading(false);
      return;
    }

    // 2. Theo dõi trạng thái đăng nhập
    const unsubscribe = AuthService.onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Giao diện khi đang tải (Nên có hiệu ứng Glass Card để đồng bộ)
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafa] dark:bg-[#020617]">
        <div className="animate-pulse text-primary font-bold">Đang khởi động Manicash...</div>
      </div>
    );
  }

  // Hiển thị lỗi cấu hình nếu có
  if (error) {
    return (
      <div className="p-10 text-red-500 bg-red-50 rounded-xl m-5 border border-red-200">
        <h2 className="font-bold">Lỗi hệ thống:</h2>
        <p>{error}</p>
      </div>
    );
  }

  // 3. Phân luồng giao diện
  return (
    <div className="transition-opacity duration-500 ease-in">
      {user ? <MainDashboard user={user} /> : <LoginScreen />}
    </div>
  );
}

export default App;
