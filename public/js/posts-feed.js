(function() {
  'use strict';

  // DOM Elements
  const feedContainer = document.getElementById('posts-feed-container');
  const emptyState = document.getElementById('feed-empty-state');
  const loadingState = document.getElementById('feed-loading-state');
  const loadMoreBtn = document.getElementById('feed-load-more-btn');
  const scrollContainer = document.getElementById('feed-scroll-container');
  const scrollToTopBtn = document.getElementById('scroll-to-top-btn');

  // State
  let posts = [];
  let isLoading = false;

  // Initialize
  function init() {
    if (!feedContainer) return;

    // Listen for new posts from post-creator
    window.addEventListener('newPostCreated', handleNewPost);
    
    // Setup scroll to top button
    setupScrollToTop();
    
    // Load initial posts
    loadPosts();
  }

  function setupScrollToTop() {
    if (!scrollContainer || !scrollToTopBtn) return;

    // Show/hide button based on scroll position
    scrollContainer.addEventListener('scroll', function() {
      if (scrollContainer.scrollTop > 200) {
        scrollToTopBtn.classList.remove('hidden');
      } else {
        scrollToTopBtn.classList.add('hidden');
      }
    });

    // Scroll to top when clicked
    scrollToTopBtn.addEventListener('click', function() {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  function handleNewPost(event) {
    const post = event.detail;
    prependPost(post);
  }

  async function loadPosts() {
    if (isLoading) return;
    
    isLoading = true;
    showLoading();

    try {
      const response = await fetch('/api/posts/feed');
      const data = await response.json();
      
      if (data.posts && data.posts.length > 0) {
        posts = data.posts;
        renderPosts();
      } else {
        showEmptyState();
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
      showEmptyState();
    } finally {
      isLoading = false;
      hideLoading();
    }
  }

  function prependPost(post) {
    posts.unshift(post);
    
    // Hide empty state if visible
    if (emptyState && !emptyState.classList.contains('hidden')) {
      emptyState.classList.add('hidden');
    }
    
    // Create and prepend post card
    const postCard = createPostCard(post);
    feedContainer.insertBefore(postCard, feedContainer.firstChild);
    
    // Animate in
    postCard.style.opacity = '0';
    postCard.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      postCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      postCard.style.opacity = '1';
      postCard.style.transform = 'translateY(0)';
    }, 10);
  }

  function renderPosts() {
    feedContainer.innerHTML = '';
    posts.forEach(post => {
      const postCard = createPostCard(post);
      feedContainer.appendChild(postCard);
    });
    
    if (emptyState) {
      emptyState.classList.add('hidden');
    }
  }

  function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-md';
    
    // Header with avatar and user info
    const header = document.createElement('div');
    header.className = 'flex items-start gap-3 mb-3';
    
    const avatar = document.createElement('div');
    avatar.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shrink-0';
    avatar.textContent = (post.userName || 'U').charAt(0).toUpperCase();
    
    const userInfo = document.createElement('div');
    userInfo.className = 'flex-1 min-w-0';
    userInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">${escapeHtml(post.userName || 'User')}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">${getTimeAgo(post.createdAt)}</span>
      </div>
    `;
    
    header.appendChild(avatar);
    header.appendChild(userInfo);
    card.appendChild(header);
    
    // Post content
    if (post.content) {
      const content = document.createElement('div');
      content.className = 'text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap';
      content.textContent = post.content;
      card.appendChild(content);
    }
    
    // Media attachments
    if (post.mediaType) {
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'mb-3';
      
      if (post.mediaType === 'image' && post.mediaUrl) {
        const img = document.createElement('img');
        img.src = post.mediaUrl;
        img.className = 'w-full rounded-lg max-h-96 object-cover border border-gray-200 dark:border-gray-700';
        img.alt = 'Post image';
        mediaContainer.appendChild(img);
      } else if (post.mediaType === 'gif' && post.mediaUrl) {
        const gif = document.createElement('img');
        gif.src = post.mediaUrl;
        gif.className = 'w-full rounded-lg max-h-96 object-cover border border-gray-200 dark:border-gray-700';
        gif.alt = 'GIF';
        mediaContainer.appendChild(gif);
      } else if (post.mediaType === 'audio') {
        mediaContainer.innerHTML = `
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900/80 dark:to-gray-800/80 rounded-lg p-3 border border-blue-200 dark:border-blue-900/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Voice Message</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${post.audioDuration || '0:00'}</p>
              </div>
            </div>
          </div>
        `;
      }
      
      card.appendChild(mediaContainer);
    }
    
    // Action buttons (like, comment, share)
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700';
    actions.innerHTML = `
      <button class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm group">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
        <span class="font-medium">${post.likes || 0}</span>
      </button>
      <button class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-sm">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <span class="font-medium">${post.comments || 0}</span>
      </button>
      <button class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-sm ml-auto">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
        </svg>
      </button>
    `;
    
    card.appendChild(actions);
    
    return card;
  }

  function showLoading() {
    if (loadingState) {
      loadingState.classList.remove('hidden');
    }
    if (emptyState) {
      emptyState.classList.add('hidden');
    }
  }

  function hideLoading() {
    if (loadingState) {
      loadingState.classList.add('hidden');
    }
  }

  function showEmptyState() {
    if (emptyState) {
      emptyState.classList.remove('hidden');
    }
    feedContainer.innerHTML = '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
    return date.toLocaleDateString();
  }

  // Export function for post-creator to call
  window.feedManager = {
    addPost: function(post) {
      prependPost(post);
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
