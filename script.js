import WaveSurfer from "./lib/wavesurfer.esm.js";
import RecordPlugin from "./lib/record.esm.js";


let wavesurfer, recordPlugin, startTime, wordCount = 0;
let lastTimeCheck = Date.now(); 
let wpmWindow = 500;  
let fontFamily;
document.addEventListener("DOMContentLoaded", () => {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'blue',
        progressColor: 'red',
    });

    recordPlugin = wavesurfer.registerPlugin(RecordPlugin.create());

    const textDisplayElement = document.getElementById('textDisplay');
    const speechStatsElement = document.getElementById('speechStats');
    const langToggleButton = document.getElementById('langToggle');
    const resetButton = document.getElementById('reset');

    let currentLanguage = 'en-IN';

    langToggleButton.addEventListener('click', function() {
        if (currentLanguage === 'en-US') {
            currentLanguage = 'hi-IN';
            langToggleButton.textContent = 'Hindi';
        } else {
            currentLanguage = 'en-US';
            langToggleButton.textContent = 'English';
        }
        recognition.lang = currentLanguage;

        if (isRecording) {
            recognition.stop();
            setTimeout(() => recognition.start(), 100);
        }
    });


    // Start recording
    document.getElementById("record").addEventListener("click", () => {
        if (!recordPlugin.isRecording()) {
            recordPlugin.startRecording();
            document.getElementById("record").textContent = "Stop Recording";
            document.getElementById("pause").style.display = "inline";
            startTime = Date.now();
            isRecording=true
            wordCount = 0;
            recognition.start(); // Start speech recognition when recording starts
        } else {
            recordPlugin.stopRecording();
            document.getElementById("record").textContent = "Start Recording";
            document.getElementById("pause").style.display = "none";
            isRecording=false
            recognition.stop(); // Stop speech recognition when recording stops
        }
    });
   

    // Pause/Resume recording
    document.getElementById("pause").addEventListener("click", () => {
        if (recordPlugin.isPaused()) {
            recordPlugin.resumeRecording();
            document.getElementById("pause").textContent = "Pause";
        } else {
            recordPlugin.pauseRecording();
            document.getElementById("pause").textContent = "Resume";
        }
    });

    // Speech recognition setup
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentLanguage;
    let newWords;
    let word;
    let transcript;
    let pitchCategory, volumeCategory, speedCategory

    let wordStartTime = 0;
    let wordCount = 0;
    let lastChar = 0;
    let newText;
    let isRecording=false;

    

    recognition.onresult = function(event) {
        const lastResult = event.results[event.results.length - 1];
        const transcript = Array.from(event.results).map(result => result[0].transcript).join(" ");
        console.log(transcript)
         newText = transcript.substring(lastChar);
        console.log("new: ",newText)
        
        lastChar = transcript.length;


        const currentTime = Date.now();
        const elapsedTimeSec = (currentTime - wordStartTime) / 1000;

        if (newText.length!=1){
            wordCount += newText.length;

            updateSpeechStats(volumeCategory, pitchCategory, speedCategory);

            const fontFamily = determineFontFamily(volumeCategory, pitchCategory, speedCategory);
            const wordElement = document.createElement('span');
            if (volumeCategory=='Loud'){
                newText=newText.toUpperCase()
            }
            else if (volumeCategory=='Soft'){
                newText=newText.toLowerCase()
            }
            else{
                newText=newText.charAt(0).toUpperCase() + newText.slice(1).toLowerCase();
            }

            wordElement.textContent = newText + ' ';
            wordElement.className = 'word';
            wordElement.style.setProperty("font-family", fontFamily.trim().toString(), "important");
            
            // Set initial small font size
            wordElement.style.fontSize = "10px"; 
            wordElement.style.opacity = "0.2"; 
            
            // Apply transition
            wordElement.style.transition = "font-size 0.5s ease-in, opacity 0.3s ease-in";
            
            // Append element first so changes are animated
            textDisplayElement.appendChild(wordElement);
            
            // Allow the browser to render before applying final size
            setTimeout(() => {
                if (volumeCategory === 'Loud') {
                    wordElement.style.fontSize = "40px";
                } else if (volumeCategory === 'Normal') {
                    wordElement.style.fontSize = "25px";
                } else {
                    wordElement.style.fontSize = "15px";
                }
                wordElement.style.opacity = "1";
            }, 50); // A short delay to let the browser recognize the transition
            
            textDisplayElement.scrollTop = textDisplayElement.scrollHeight;
    };}

   

    resetButton.addEventListener('click', async function() {
        recordPlugin.stopRecording();
        await wavesurfer.empty()
        document.getElementById("record").textContent = "Start Recording";
        document.getElementById("pause").style.display = "none";
        isRecording=false
        recognition.stop();
        textDisplayElement.innerHTML = '';
        speechStatsElement.textContent = 'Speech characteristics will appear here';
        wordCount = 0;
    });

  

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
    };

    recognition.onend = () => {
        if (recordPlugin.isRecording()) {
            recognition.start(); // Restart recognition if recording is still active
        }
    };
    let currentTime;

    // Analyze audio in real-time after decoding
    wavesurfer.on('decode', () => {
        currentTime = Date.now();
        if (currentTime - lastTimeCheck >= wpmWindow) {
            lastTimeCheck = currentTime;
            
            const audioBuffer = wavesurfer.getDecodedData();
            if (audioBuffer) {
                analyzeAudio(audioBuffer);  // Only analyze once per window
            }
        }
    });

    // Analyze audio (volume, pitch, speech speed)
    function analyzeAudio(audioBuffer) {
        // console.log(audioBuffer);
        const rawData = audioBuffer.getChannelData(0);  // Get audio samples for the first channel

        // Volume Calculation (RMS)
        let sumSquares = 0;
        for (let i = 0; i < rawData.length; i++) {
            sumSquares += rawData[i] ** 2;
        }
        let volume = Math.sqrt(sumSquares / rawData.length) * 100;
        volumeCategory = volume > 10 ? "Loud" : volume < 4 ? "Soft" : "Normal";

        // console.log("Volume:", volume.toFixed(2));
        document.getElementById("volume-level").textContent = `${volumeCategory} ${volume.toFixed(2)}`;

        // Pitch Calculation (Estimate based on dominant frequency)
        let maxIndex = rawData.findIndex((val) => val === Math.max(...rawData));
        let pitch = maxIndex * (wavesurfer.options.sampleRate / rawData.length);
        pitchCategory = pitch > 5000 ? "HighPitch" : pitch < 2000 ? "LowPitch" : "NormalPitch";

        document.getElementById("pitch-level").textContent = `${pitchCategory} ${pitch.toFixed(2)}`;
        // console.log("Pitch:", pitch.toFixed(2), "Hz");

        // Speech Speed Calculation (WPM over the last window)
        let elapsedTime = (currentTime - startTime) / 1000 / 60;  // Convert ms to minutes
        let wpm = wordCount / (elapsedTime || 1);  // Prevent division by zero

        // console.log("Speed:", wpm);
        speedCategory = wpm > 400 ? "Fast" : wpm < 150 ? "Slow" : "Normal";
        document.getElementById("speed-level").textContent = `${speedCategory} (${wpm.toFixed(2)} WPM)`;

       

        // Reset word count and start time for the next window
        wordCount = 0;
        startTime = Date.now(); // Start new time window
    }

    function determineFontFamily(volume, pitch, speed) {
        const characteristics = [];

        if (volume !== 'Normal') characteristics.push(volume);
        if (pitch !== 'NormalPitch') characteristics.push(pitch);
        if (speed !== 'Normal') characteristics.push(speed);
        return characteristics.length === 0 ? 'SoundType-Regular' : 'SoundType-' + characteristics.join('-');
    }

    function updateSpeechStats(volume, pitch, speed) {
        const characteristics = [];
        if (volume !== 'Normal') characteristics.push(volume.toUpperCase());
        if (pitch !== 'NormalPitch') {
            characteristics.push(pitch === 'HighPitch' ? 'HIGH PITCH' : 'LOW PITCH');
        }
        if (speed !== 'Normal') characteristics.push(speed.toUpperCase());

        speechStatsElement.textContent = characteristics.length === 0 ? 'Your speech was at a NORMAL level.' : 'Your speech was ' + characteristics.join(' & ') + '.';
    }

    // Handle pause/resume logic for speech recognition (optional)
    document.getElementById("pause").addEventListener("click", () => {
        if (recognition.continuous) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
});
