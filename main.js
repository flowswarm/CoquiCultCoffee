import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

async function init() {
  // Fetch and render Instagram data
  try {
    const res = await fetch('/content.json');
    if (res.ok) {
      const posts = await res.json();
      renderGallery(posts);
    } else {
      console.error("Failed to load content.json");
    }
  } catch (err) {
    console.error("Error loading content:", err);
  }

  // Initialize GSAP Animations
  initAnimations();
}

function renderGallery(posts) {
  const container = document.getElementById('gallery-container');
  if (!container) return;

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // Parse date
    const date = new Date(post.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Handle video vs image
    let mediaHTML = '';
    if (post.type === 'Video' || post.mediaPath.endsWith('.mp4')) {
      mediaHTML = `<video src="${post.mediaPath}" autoplay loop muted playsinline></video>`;
    } else {
      mediaHTML = `<img src="${post.mediaPath}" alt="Instagram Post" loading="lazy" />`;
    }

    card.innerHTML = `
      <div class="media-container">
        ${mediaHTML}
      </div>
      <div class="post-content">
        <p class="post-caption">${post.caption || ''}</p>
        <div class="post-meta">
          <span>♥ ${post.likesCount || 0}</span>
          <span>${dateStr}</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function initAnimations() {
  // Hero Animations
  const tl = gsap.timeline();

  // Hero Parallax
  gsap.to('.hero-video', {
    yPercent: 30,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true
    }
  });

  // Section Header Text Reveal
  gsap.fromTo('.reveal-text', 
    { y: 50, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 1,
      stagger: 0.2,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".section-header",
        start: "top 80%",
      }
    }
  );

  // Gallery Cards Stagger
  // Use a slight delay so DOM has time to render images
  setTimeout(() => {
    const cards = document.querySelectorAll('.post-card');
    
    cards.forEach((card, i) => {
      gsap.to(card, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          onComplete: () => {
            card.classList.add('entered');
          }
        }
      });
    });
  }, 100);
}

document.addEventListener('DOMContentLoaded', init);
