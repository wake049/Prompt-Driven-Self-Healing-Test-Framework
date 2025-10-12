import { AppRoutes } from "./app/routes";
import Navbar from "./shared/ui/Navbar";
import "./styles/index.css";
import "./styles/App.css";

export default function App() {
  const appStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem',
    width: '100%'
  };

  return (
    <div style={appStyle}>
      <Navbar />
      <main style={mainStyle}>
        <AppRoutes />
      </main>
    </div>
  );
}