import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/Login/LoginPage';
import HomePage from './pages/Home/HomePage';
import IngredientsPage from './pages/Ingredients/IngredientsPage';
import DishesPage from './pages/Dishes/DishesPage';
import MenusPage from './pages/Menus/MenusPage';
import ProfilePage from './pages/Profile/ProfilePage';
import PartyPage from './pages/Party/PartyPage';
import PartyGuestPage from './pages/Party/PartyGuestPage';
import Toast from './components/Toast';
import './index.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* 游客饭局页面 - 无需登录 */}
        <Route path="/party/join/:code" element={<PartyGuestPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="dishes" element={<DishesPage />} />
          <Route path="menus" element={<MenusPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="party" element={<PartyPage />} />
        </Route>
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}
