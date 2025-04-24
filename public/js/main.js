document.addEventListener('DOMContentLoaded', () => {

    // --- Simple Scroll Fade-In Effect ---
    const animatedElements = document.querySelectorAll('.animate-fadeInUp, .animate-fadeInDown, .animate-slideInLeft, .animate-slideInRight, .animate-fadeIn');

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Start the animation by removing the initial opacity=0 style
                    // Tailwind animations typically start automatically when class is added,
                    // but we delay adding the *visible* state until intersection.
                     // For this setup, we apply opacity:0 inline and remove it here.
                    entry.target.style.opacity = 1;

                    // Optional: Add a class to signify it's loaded
                    entry.target.classList.add('fade-in-loaded');

                    // Unobserve the element after it has animated once
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null, // relative to the viewport
            threshold: 0.1 // trigger when 10% of the element is visible
        });

        animatedElements.forEach(el => {
            // Ensure elements start hidden if using JS to trigger animation visibility
            // They already have `opacity:0` set inline via style attribute
            observer.observe(el);
        });

    } else {
        // Fallback for older browsers: just make elements visible
        animatedElements.forEach(el => el.style.opacity = 1);
    }


    // --- Mobile Nav Handling (Already handled by Alpine.js in HTML) ---
    // No specific JS needed here if using Alpine for the nav toggle.

    // --- Smooth Scrolling for Anchor Links ---
     document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
             // Check if it's just a hash link on the *current* page
            if (this.pathname === window.location.pathname && this.hash) {
                e.preventDefault();
                const targetElement = document.querySelector(this.hash);
                if (targetElement) {
                     const headerOffset = 96; // Adjusted height of fixed header (h-24 = 6rem = 96px)
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth"
                    });

                     // Optional: Close mobile menu if open after clicking a link
                    const mobileMenuButton = document.querySelector('[aria-controls="mobile-menu"]');
                    if(mobileMenuButton && mobileMenuButton.__x && mobileMenuButton.__x.$data.open) {
                        mobileMenuButton.__x.$data.open = false;
                    }
                }
            }
        });
    });

    // Add more general JS interactions here if needed...

});
