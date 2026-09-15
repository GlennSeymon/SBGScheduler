import { Outlet } from 'react-router-dom';
import './AppShell.css';

const AppShell = () => {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1>SBG Scheduler</h1>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
