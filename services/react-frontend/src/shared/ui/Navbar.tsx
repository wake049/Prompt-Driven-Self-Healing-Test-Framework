import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Elements', icon: '🔍' },
    { path: '/review', label: 'Review Queue', icon: '📋' }
  ];

  const navbarStyle: React.CSSProperties = {
    background: 'var(--primary-gradient)',
    color: 'white',
    boxShadow: 'var(--shadow-lg)',
    padding: '0',
    margin: '0'
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '64px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    margin: '0'
  };

  const navLinksStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: 'var(--border-radius-sm)',
    textDecoration: 'none',
    color: isActive ? 'white' : 'rgba(255, 255, 255, 0.8)',
    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    transition: 'var(--transition)',
    fontSize: '0.9rem',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  });

  return (
    <nav style={navbarStyle}>
      <div style={containerStyle}>
        <div>
          <h1 style={titleStyle}>Self-Healing Test Framework</h1>
        </div>
        
        <div style={navLinksStyle}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={linkStyle(location.pathname === item.path)}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;