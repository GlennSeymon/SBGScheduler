import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell';
import JobsPage from './pages/JobsPage';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<JobsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
