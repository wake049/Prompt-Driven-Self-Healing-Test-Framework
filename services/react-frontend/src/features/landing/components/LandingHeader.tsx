import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const HeaderContainer = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #D3D1C7;
  padding: 20px 64px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  @media (max-width: 768px) {
    padding: 16px 24px;
  }
`;

const Nav = styled.nav`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled.div`
  font-size: 24px;
  font-weight: 800;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  color: #1A1A1A;

  span {
    font-weight: 400;
    color: #185FA5;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 40px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavLink = styled.a`
  font-size: 16px;
  font-weight: 600;
  color: #1A1A1A;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.3s ease;

  &:hover {
    color: #378ADD;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const LoginButton = styled.button`
  background: transparent;
  color: #1A1A1A;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #E6F1FB;
  }
`;

const RegisterButton = styled.button`
  background: transparent;
  color: #185FA5;
  border: 1px solid #185FA5;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #E6F1FB;
  }
`;

const SignUpButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(24, 95, 165, 0.25);

  &:hover {
    background: #378ADD;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(24, 95, 165, 0.35);
  }
`;

export const LandingHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
    <HeaderContainer>
      <Nav>
        <Logo onClick={() => navigate('/')}>Flux<span>Test</span></Logo>
        
        <NavLinks>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#how-it-works">How It Works</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
          <NavLink onClick={() => navigate('/docs')}>Documentation</NavLink>
        </NavLinks>

        <ButtonGroup>
          <LoginButton onClick={() => navigate('/login')}>
            Log In
          </LoginButton>
          <RegisterButton onClick={() => navigate('/register')}>
            Register
          </RegisterButton>
          <SignUpButton onClick={() => navigate('/demo-videos')}>
            Product Tour
          </SignUpButton>
        </ButtonGroup>
      </Nav>
    </HeaderContainer>
  );
};
