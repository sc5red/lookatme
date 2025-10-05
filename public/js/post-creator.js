(function() {
  'use strict';

  // DOM Elements
  const textInput = document.getElementById('post-text-input');
  const charCounter = document.getElementById('char-counter');
  const submitBtn = document.getElementById('post-submit-btn');
  const errorEl = document.getElementById('post-error');
  const mediaPreviewContainer = document.getElementById('media-preview-container');

  // Voice elements
  const voiceBtn = document.getElementById('voice-btn');
  const voiceModal = document.getElementById('voice-modal');
  const voiceModalClose = document.getElementById('voice-modal-close');
  const recordToggleBtn = document.getElementById('record-toggle-btn');
  const recordingTimer = document.getElementById('recording-timer');
  const recordingStatus = document.getElementById('recording-status');
  const recordingActions = document.getElementById('recording-actions');
  const voiceCancelBtn = document.getElementById('voice-cancel-btn');
  const voiceSaveBtn = document.getElementById('voice-save-btn');
  const audioPreview = document.getElementById('audio-preview');
  const audioRemoveBtn = document.getElementById('audio-remove-btn');

  // Image elements
  const imageBtn = document.getElementById('image-btn');
  const imageModal = document.getElementById('image-modal');
  const imageModalClose = document.getElementById('image-modal-close');
  const fileUpload = document.getElementById('file-upload');
  const cameraBtn = document.getElementById('camera-btn');
  const cameraView = document.getElementById('camera-view');
  const cameraStream = document.getElementById('camera-stream');
  const cameraCaptureBtn = document.getElementById('camera-capture-btn');
  const cameraCancelBtn = document.getElementById('camera-cancel-btn');
  const cameraCanvas = document.getElementById('camera-canvas');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImg = document.getElementById('image-preview-img');
  const imageRemoveBtn = document.getElementById('image-remove-btn');

  // GIF elements
  const gifBtn = document.getElementById('gif-btn');
  const gifModal = document.getElementById('gif-modal');
  const gifModalClose = document.getElementById('gif-modal-close');
  const gifSearchInput = document.getElementById('gif-search-input');
  const gifGrid = document.getElementById('gif-grid');
  const gifTabs = document.querySelectorAll('.gif-tab');
  const gifPreview = document.getElementById('gif-preview');
  const gifPreviewImg = document.getElementById('gif-preview-img');
  const gifRemoveBtn = document.getElementById('gif-remove-btn');

  // State
  let currentMedia = null; // {type: 'audio|image|gif', data: ...}
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let recordingSeconds = 0;
  let cameraStreamObj = null;
  let gifFavorites = JSON.parse(localStorage.getItem('gifFavorites') || '[]');
  let currentGifTab = 'trending';

  const TENOR_API_KEY = ''; // Free Tenor key

  // Initialize
  function init() {
    if (!textInput) return;

    textInput.addEventListener('input', updateCharCounter);
    submitBtn.addEventListener('click', handleSubmit);

    // Voice
    voiceBtn.addEventListener('click', openVoiceModal);
    voiceModalClose.addEventListener('click', closeVoiceModal);
    recordToggleBtn.addEventListener('click', toggleRecording);
    voiceCancelBtn.addEventListener('click', cancelVoiceRecording);
    voiceSaveBtn.addEventListener('click', saveVoiceRecording);
    audioRemoveBtn.addEventListener('click', removeAudio);

    // Image
    imageBtn.addEventListener('click', openImageModal);
    imageModalClose.addEventListener('click', closeImageModal);
    fileUpload.addEventListener('change', handleFileUpload);
    cameraBtn.addEventListener('click', openCamera);
    cameraCaptureBtn.addEventListener('click', capturePhoto);
    cameraCancelBtn.addEventListener('click', closeCamera);
    imageRemoveBtn.addEventListener('click', removeImage);

    // GIF
    gifBtn.addEventListener('click', openGifModal);
    gifModalClose.addEventListener('click', closeGifModal);
    gifSearchInput.addEventListener('input', debounce(searchGifs, 500));
    gifTabs.forEach(tab => tab.addEventListener('click', switchGifTab));
    gifRemoveBtn.addEventListener('click', removeGif);

    updateCharCounter();
  }

  // === Character Counter & Validation ===
  function updateCharCounter() {
    const len = textInput.value.length;
    charCounter.textContent = `${len}/100`;
    
    const hasContent = len > 0 || currentMedia !== null;
    submitBtn.disabled = !hasContent || len > 100;
    
    if (len > 100) {
      charCounter.classList.add('text-red-500');
      charCounter.classList.remove('text-gray-500');
    } else {
      charCounter.classList.remove('text-red-500');
      charCounter.classList.add('text-gray-500', 'dark:text-gray-400');
    }
  }

  // === Voice Recording ===
  function openVoiceModal() {
    voiceModal.classList.remove('hidden');
    voiceModal.style.display = 'flex';
    voiceModal.style.alignItems = 'center';
    voiceModal.style.justifyContent = 'center';
    resetRecordingUI();
  }

  function closeVoiceModal() {
    voiceModal.classList.add('hidden');
    voiceModal.style.display = 'none';
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    stopRecordingTimer();
  }

  function resetRecordingUI() {
    recordingSeconds = 0;
    recordingTimer.textContent = '0:00';
    recordingStatus.textContent = 'Tap to start recording';
    recordingActions.classList.add('hidden');
    recordingActions.style.display = 'none';
    recordToggleBtn.classList.remove('bg-gray-500');
    recordToggleBtn.classList.add('bg-red-500');
  }

  async function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      await startRecording();
    } else {
      stopRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      
      // Create MediaRecorder with proper options
      const options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/ogg; codecs=opus';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = '';
        }
      }
      
      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log('Audio chunk collected:', e.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, total chunks:', audioChunks.length);
        stream.getTracks().forEach(track => track.stop());
        stopWaveformAnimation();
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started');
        startWaveformAnimation();
      };

      // Start recording and request data every 100ms
      mediaRecorder.start(100);
      recordingStatus.textContent = 'Recording...';
      recordToggleBtn.classList.remove('bg-red-500');
      recordToggleBtn.classList.add('bg-gray-500');
      startRecordingTimer();
    } catch (err) {
      console.error('Recording error:', err);
      showError('Microphone access denied: ' + err.message);
    }
  }

  // Simple waveform animation during recording
  let waveformAnimationInterval = null;
  
  function startWaveformAnimation() {
    const waveformBars = document.getElementById('waveform-bars');
    if (!waveformBars) return;
    
    // Clear existing bars
    waveformBars.innerHTML = '';
    
    // Create animated bars
    const numBars = 20;
    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'w-1 bg-blue-500 rounded-full transition-all duration-150';
      bar.style.height = '20%';
      waveformBars.appendChild(bar);
    }
    
    // Animate bars
    waveformAnimationInterval = setInterval(() => {
      const bars = waveformBars.querySelectorAll('div');
      bars.forEach((bar) => {
        const height = Math.random() * 80 + 20; // 20-100%
        bar.style.height = height + '%';
      });
    }, 150);
  }
  
  function stopWaveformAnimation() {
    if (waveformAnimationInterval) {
      clearInterval(waveformAnimationInterval);
      waveformAnimationInterval = null;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordingStatus.textContent = 'Recording stopped';
      recordingActions.classList.remove('hidden');
      recordingActions.style.display = 'flex';
      stopRecordingTimer();
    }
  }

  function startRecordingTimer() {
    recordingSeconds = 0;
    recordingInterval = setInterval(() => {
      recordingSeconds++;
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      recordingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      if (recordingSeconds >= 60) { // Max 1 minute
        stopRecording();
      }
    }, 1000);
  }

  function stopRecordingTimer() {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
  }

  function cancelVoiceRecording() {
    audioChunks = [];
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    closeVoiceModal();
  }

  function saveVoiceRecording() {
    if (audioChunks.length === 0) {
      showError('No audio recorded');
      return;
    }

    console.log('Saving recording with', audioChunks.length, 'chunks');
    
    // Determine the MIME type from the recorded chunks
    const mimeType = audioChunks[0].type || 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: mimeType });
    
    console.log('Audio blob created:', audioBlob.size, 'bytes, type:', mimeType);
    
    // Create a URL for the audio blob
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentMedia = {
      type: 'audio',
      data: audioBlob,
      url: audioUrl,
      duration: recordingSeconds,
      mimeType: mimeType
    };

    // Show preview
    mediaPreviewContainer.classList.remove('hidden');
    audioPreview.classList.remove('hidden');
    document.getElementById('audio-duration').textContent = 
      `${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}`;

    // Setup audio playback
    setupAudioPlayback(audioUrl);

    closeVoiceModal();
    updateCharCounter();
    clearOtherMedia('audio');
  }

  function setupAudioPlayback(audioUrl) {
    const playBtn = document.getElementById('audio-play-btn');
    const waveformContainer = document.getElementById('audio-waveform');
    
    // Create or get audio element
    let audioElement = document.getElementById('audio-player');
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'audio-player';
      audioElement.preload = 'auto';
      document.body.appendChild(audioElement);
    }
    
    audioElement.src = audioUrl;
    
    // Update play button icon based on state
    let isPlaying = false;
    
    const updatePlayButton = (playing) => {
      isPlaying = playing;
      playBtn.innerHTML = playing 
        ? `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>`
        : `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
          </svg>`;
    };
    
    // Play/pause handler
    playBtn.onclick = () => {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play().catch(err => {
          console.error('Playback error:', err);
          showError('Failed to play audio');
        });
      }
    };
    
    // Audio event listeners
    audioElement.onplay = () => updatePlayButton(true);
    audioElement.onpause = () => updatePlayButton(false);
    audioElement.onended = () => updatePlayButton(false);
    
    // Visual feedback - simple progress bar
    audioElement.ontimeupdate = () => {
      if (audioElement.duration) {
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        waveformContainer.style.background = `linear-gradient(to right, #3b82f6 ${progress}%, transparent ${progress}%)`;
      }
    };
    
    console.log('Audio playback setup complete');
  }

  function removeAudio() {
    if (currentMedia && currentMedia.type === 'audio') {
      // Clean up audio URL
      if (currentMedia.url) {
        URL.revokeObjectURL(currentMedia.url);
      }
      
      // Stop and remove audio element
      const audioElement = document.getElementById('audio-player');
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      
      currentMedia = null;
    }
    audioPreview.classList.add('hidden');
    mediaPreviewContainer.classList.add('hidden');
    updateCharCounter();
  }

  // === Image Upload ===
  function openImageModal() {
    imageModal.classList.remove('hidden');
    imageModal.style.display = 'flex';
    imageModal.style.alignItems = 'center';
    imageModal.style.justifyContent = 'center';
  }

  function closeImageModal() {
    imageModal.classList.add('hidden');
    imageModal.style.display = 'none';
    closeCamera();
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
      closeImageModal();
    }
  }

  async function openCamera() {
    try {
      cameraStreamObj = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      cameraStream.srcObject = cameraStreamObj;
      cameraView.classList.remove('hidden');
    } catch (err) {
      showError('Camera access denied');
    }
  }

  function closeCamera() {
    if (cameraStreamObj) {
      cameraStreamObj.getTracks().forEach(track => track.stop());
      cameraStreamObj = null;
    }
    cameraView.classList.add('hidden');
  }

  function capturePhoto() {
    const context = cameraCanvas.getContext('2d');
    cameraCanvas.width = cameraStream.videoWidth;
    cameraCanvas.height = cameraStream.videoHeight;
    context.drawImage(cameraStream, 0, 0);
    
    cameraCanvas.toBlob((blob) => {
      loadImage(blob);
      closeImageModal();
    }, 'image/jpeg', 0.9);
  }

  function loadImage(fileOrBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentMedia = {
        type: 'image',
        data: fileOrBlob,
        url: e.target.result
      };

      mediaPreviewContainer.classList.remove('hidden');
      imagePreview.classList.remove('hidden');
      imagePreviewImg.src = e.target.result;
      
      updateCharCounter();
      clearOtherMedia('image');
    };
    reader.readAsDataURL(fileOrBlob);
  }

  function removeImage() {
    if (currentMedia && currentMedia.type === 'image') {
      currentMedia = null;
    }
    imagePreview.classList.add('hidden');
    mediaPreviewContainer.classList.add('hidden');
    updateCharCounter();
  }

  // === GIF Picker ===
  function openGifModal() {
    gifModal.classList.remove('hidden');
    gifModal.style.display = 'flex';
    gifModal.style.alignItems = 'center';
    gifModal.style.justifyContent = 'center';
    loadTrendingGifs();
  }

  function closeGifModal() {
    gifModal.classList.add('hidden');
    gifModal.style.display = 'none';
  }

  function switchGifTab(e) {
    const tab = e.target.dataset.tab;
    currentGifTab = tab;
    
    gifTabs.forEach(t => {
      t.classList.remove('active', 'bg-blue-100', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-400');
      t.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
    });
    
    e.target.classList.add('active', 'bg-blue-100', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-400');
    e.target.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');

    if (tab === 'trending') {
      loadTrendingGifs();
    } else {
      loadFavoriteGifs();
    }
  }

  async function loadTrendingGifs() {
    gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400"><div class="animate-pulse">Loading GIFs...</div></div>';
    
    try {
      const response = await fetch(`https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`);
      const data = await response.json();
      displayGifs(data.results);
    } catch (err) {
      gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">Failed to load GIFs</div>';
    }
  }

  async function searchGifs() {
    const query = gifSearchInput.value.trim();
    if (!query) {
      loadTrendingGifs();
      return;
    }

    gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400"><div class="animate-pulse">Searching...</div></div>';
    
    try {
      const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`);
      const data = await response.json();
      displayGifs(data.results);
    } catch (err) {
      gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">Search failed</div>';
    }
  }

  function displayGifs(gifs) {
    if (!gifs || gifs.length === 0) {
      gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">No GIFs found</div>';
      return;
    }

    gifGrid.innerHTML = gifs.map(gif => {
      const isFavorite = gifFavorites.some(fav => fav.id === gif.id);
      const media = gif.media_formats.tinygif || gif.media_formats.gif;
      
      return `
        <div class="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 aspect-square" 
             onclick="window.postCreator.selectGif('${gif.id}', '${media.url}')">
          <img src="${media.url}" class="w-full h-full object-cover" alt="GIF">
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <button class="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center transition-opacity"
                    onclick="event.stopPropagation(); window.postCreator.toggleFavorite('${gif.id}', '${media.url}', this)">
              <svg class="w-5 h-5 ${isFavorite ? 'fill-red-500' : 'fill-none'} stroke-current ${isFavorite ? 'text-red-500' : 'text-gray-700'}" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function loadFavoriteGifs() {
    if (gifFavorites.length === 0) {
      gifGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">No favorite GIFs yet</div>';
      return;
    }

    gifGrid.innerHTML = gifFavorites.map(gif => `
      <div class="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 aspect-square" 
           onclick="window.postCreator.selectGif('${gif.id}', '${gif.url}')">
        <img src="${gif.url}" class="w-full h-full object-cover" alt="GIF">
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <button class="opacity-0 group-hover:opacity-100 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center transition-opacity"
                  onclick="event.stopPropagation(); window.postCreator.toggleFavorite('${gif.id}', '${gif.url}', this)">
            <svg class="w-5 h-5 fill-red-500 text-red-500" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  function selectGif(id, url) {
    currentMedia = {
      type: 'gif',
      id: id,
      url: url
    };

    mediaPreviewContainer.classList.remove('hidden');
    gifPreview.classList.remove('hidden');
    gifPreviewImg.src = url;

    closeGifModal();
    updateCharCounter();
    clearOtherMedia('gif');
  }

  function toggleFavorite(id, url, btn) {
    const index = gifFavorites.findIndex(fav => fav.id === id);
    
    if (index > -1) {
      gifFavorites.splice(index, 1);
    } else {
      gifFavorites.push({ id, url });
    }
    
    localStorage.setItem('gifFavorites', JSON.stringify(gifFavorites));

    if (currentGifTab === 'trending') {
      loadTrendingGifs();
    } else {
      loadFavoriteGifs();
    }
  }

  function removeGif() {
    if (currentMedia && currentMedia.type === 'gif') {
      currentMedia = null;
    }
    gifPreview.classList.add('hidden');
    mediaPreviewContainer.classList.add('hidden');
    updateCharCounter();
  }

  // === Helpers ===
  function clearOtherMedia(keepType) {
    if (keepType !== 'audio') audioPreview.classList.add('hidden');
    if (keepType !== 'image') imagePreview.classList.add('hidden');
    if (keepType !== 'gif') gifPreview.classList.add('hidden');
    
    if (!audioPreview.classList.contains('hidden') || 
        !imagePreview.classList.contains('hidden') || 
        !gifPreview.classList.contains('hidden')) {
      mediaPreviewContainer.classList.remove('hidden');
    } else {
      mediaPreviewContainer.classList.add('hidden');
    }
  }

  function showError(message) {
    errorEl.querySelector('p').textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // === Submit ===
  async function handleSubmit() {
    const text = textInput.value.trim();
    
    if (!text && !currentMedia) return;
    if (text.length > 100) {
      showError('Text must be 100 characters or less');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
      // Build JSON payload instead of FormData for now
      const payload = {
        content: text
      };
      
      if (currentMedia) {
        payload.mediaType = currentMedia.type;
        
        if (currentMedia.type === 'audio') {
          // For now, store base64 data URL (in production, upload to server)
          payload.duration = currentMedia.duration;
          // Note: File upload will be added later with multer
        } else if (currentMedia.type === 'image') {
          // For now, store base64 data URL (in production, upload to server)
          // Note: File upload will be added later with multer
        } else if (currentMedia.type === 'gif') {
          payload.gifUrl = currentMedia.url;
          payload.gifId = currentMedia.id;
        }
      }

      const response = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        // Clear form
        textInput.value = '';
        currentMedia = null;
        mediaPreviewContainer.classList.add('hidden');
        audioPreview.classList.add('hidden');
        imagePreview.classList.add('hidden');
        gifPreview.classList.add('hidden');
        updateCharCounter();
        
        // Dispatch event for feed to pick up the new post
        window.dispatchEvent(new CustomEvent('newPostCreated', { detail: result.post }));
        
        console.log('Post created:', result);
      } else {
        showError(result.error || 'Failed to create post');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post';
    }
  }

  // Expose functions for inline onclick handlers
  window.postCreator = {
    selectGif,
    toggleFavorite
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
