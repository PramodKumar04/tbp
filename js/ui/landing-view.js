import { auth } from '../auth.js';

export function renderLandingView(container) {
    container.innerHTML = `
        <section class="hero">
            <div class="carousel-bg" id="hero-carousel">
                <div class="carousel-slide active" style="background-image: url('js/images/image1.jpg')"></div>
                <div class="carousel-slide" style="background-image: url('js/images/image2.jpg')"></div>
                <div class="carousel-slide" style="background-image: url('js/images/image3.jpg')"></div>
                <div class="carousel-slide" style="background-image: url('js/images/image4.jpg')"></div>
                <div class="carousel-slide" style="background-image: url('js/images/generated_hero.png')"></div>
            </div>
            <div class="hero-overlay"></div>
            
            <div class="container">
                <div class="hero-content">
                    <h1>BharatSupply: AI-Powered Logistics</h1>
                    <p>Optimize your port-to-plant logistics with real-time tracking, MILP-based optimization, and predictive AI.</p>
                </div>

                <div class="auth-card" id="auth-container">
                    <div class="auth-tabs">
                        <div class="tab active" id="login-tab">Login</div>
                        <div class="tab" id="signup-tab">Sign Up</div>
                    </div>

                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" id="login-email" placeholder="name@company.com" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="login-password" placeholder="••••••••" required>
                        </div>
                        <button type="submit" class="btn-auth">Access Dashboard</button>
                        <div id="login-error" class="error-msg"></div>
                    </form>

                    <form id="signup-form" class="auth-form" style="display: none;">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" id="signup-username" placeholder="johndoe" required>
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" id="signup-email" placeholder="name@company.com" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="signup-password" placeholder="••••••••" required>
                            <div id="password-strength-container" style="margin-top: 8px; display: none;">
                                <div style="display: flex; gap: 4px; height: 4px;">
                                    <div class="strength-bar" style="flex: 1; background: #333; border-radius: 2px;"></div>
                                    <div class="strength-bar" style="flex: 1; background: #333; border-radius: 2px;"></div>
                                    <div class="strength-bar" style="flex: 1; background: #333; border-radius: 2px;"></div>
                                    <div class="strength-bar" style="flex: 1; background: #333; border-radius: 2px;"></div>
                                </div>
                                <p id="strength-text" style="font-size: 10px; color: #64748b; margin-top: 4px;"></p>
                            </div>
                        </div>
                        <button type="submit" class="btn-auth" id="signup-btn">Create Account</button>
                        <div id="signup-error" class="error-msg"></div>
                    </form>
                </div>
            </div>
        </section>
    `;

    bindLandingEvents(container);
    startCarousel();
}

function bindLandingEvents(container) {
    const loginTab = container.querySelector('#login-tab');
    const signupTab = container.querySelector('#signup-tab');
    const loginForm = container.querySelector('#login-form');
    const signupForm = container.querySelector('#signup-form');

    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#login-email').value;
        const pass = container.querySelector('#login-password').value;
        const errMsg = container.querySelector('#login-error');
        
        try {
            await auth.login(email, pass);
            location.reload(); // Refresh to trigger DashboardView
        } catch (err) {
            errMsg.textContent = err.message;
        }
    });

    const signupPass = container.querySelector('#signup-password');
    const signupBtn = container.querySelector('#signup-btn');
    const strengthContainer = container.querySelector('#password-strength-container');
    const strengthBars = container.querySelectorAll('.strength-bar');
    const strengthText = container.querySelector('#strength-text');

    signupPass.addEventListener('input', () => {
        const val = signupPass.value;
        if (!val) {
            strengthContainer.style.display = 'none';
            return;
        }

        strengthContainer.style.display = 'block';
        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[@$!%*?&]/.test(val)) score++;

        strengthBars.forEach((bar, i) => {
            if (i < score) {
                bar.style.background = score <= 1 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#10b981';
            } else {
                bar.style.background = '#333';
            }
        });

        const status = score <= 1 ? 'Weak' : score <= 3 ? 'Good' : 'Strong';
        strengthText.textContent = `Strength: ${status} (Min. 8 chars, 1 uppercase, 1 number, 1 special)`;
        strengthText.style.color = score <= 1 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#10b981';

        signupBtn.disabled = score < 4;
        signupBtn.style.opacity = score < 4 ? '0.5' : '1';
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = container.querySelector('#signup-username').value;
        const email = container.querySelector('#signup-email').value;
        const pass = signupPass.value;
        const errMsg = container.querySelector('#signup-error');
        
        try {
            await auth.signup(user, email, pass);
            location.reload();
        } catch (err) {
            errMsg.textContent = err.message;
        }
    });
}

function startCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 6000);
}
