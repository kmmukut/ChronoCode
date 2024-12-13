document.getElementById('pasteKeyBtn').addEventListener('click', async () => {
    try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText) {
            alert('Clipboard is empty or contains invalid text.');
            return;
        }
        document.getElementById('keyInput').value = clipboardText;
    } catch (error) {
        console.error('Error pasting key:', error);
        alert('Clipboard access failed. Please paste the key manually into the input field.');
    }
});

let totpInterval;
let countdownInterval;

function startTOTPUpdate(secretKey) {
    if (totpInterval) clearInterval(totpInterval); // Clear existing TOTP interval
    if (countdownInterval) clearInterval(countdownInterval); // Clear existing countdown interval

    const radius = 45; // Circle radius
    const circumference = 2 * Math.PI * radius; // Circle circumference
    const circle = document.querySelectorAll('.progress-ring__circle')[1]; // The dynamic circle
    circle.style.strokeDasharray = `${circumference} ${circumference}`; // Set total stroke length

    const updateToken = async () => {
        const currentTime = Date.now();
        const remainingTime = 30 - Math.floor((currentTime / 1000) % 30); // Calculate remaining seconds

        const totp = await generateTOTP(secretKey);
        const display = document.getElementById('totpDisplay');
        const copyBtn = document.getElementById('copyBtn');
        const countdown = document.getElementById('countdown');

        // Update TOTP display
        display.textContent = totp;
        copyBtn.style.display = 'inline-block';
        copyBtn.onclick = () => navigator.clipboard.writeText(totp);

        // Reset progress circle and sync with remaining time
        const offset = (remainingTime / 30) * circumference; // Calculate stroke-dashoffset
        circle.style.strokeDashoffset = circumference - offset; // Set stroke-dashoffset dynamically

        // Update countdown immediately
        countdown.textContent = `${remainingTime}`;

        // Start real-time countdown
        let countdownValue = remainingTime;
        if (countdownInterval) clearInterval(countdownInterval); // Clear existing interval
        countdownInterval = setInterval(() => {
            countdownValue--;
            countdown.textContent = `${countdownValue}`;

            // Update the circular progress
            const newOffset = ((30 - countdownValue) / 30) * circumference;
            circle.style.strokeDashoffset = newOffset;

            // Stop the countdown when it hits 0
            if (countdownValue <= 0) clearInterval(countdownInterval);
        }, 1000);

        // Schedule the next TOTP update at the start of the next period
        if (totpInterval) clearTimeout(totpInterval);
        totpInterval = setTimeout(updateToken, remainingTime * 1000);
    };

    updateToken(); // Call immediately to align with the current time
}

document.getElementById('generateBtn').addEventListener('click', () => {
    const key = document.getElementById('keyInput').value.trim().replace(/\s+/g, ''); // Remove spaces
    if (!key) {
        alert('Please enter a valid Base32-encoded key.');
        return;
    }
    try {
        startTOTPUpdate(key);
    } catch (error) {
        console.error('Error generating TOTP:', error);
        alert('Invalid Base32-encoded key. Please check your input.');
    }
});

async function generateTOTP(secretKeyBase32) {
    const secretKey = base32Decode(secretKeyBase32);
    const timeStep = Math.floor(Date.now() / 30000);
    const hmac = await generateHMAC(secretKey, timeStep);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binaryCode = ((hmac[offset] & 0x7f) << 24) |
                       ((hmac[offset + 1] & 0xff) << 16) |
                       ((hmac[offset + 2] & 0xff) << 8) |
                       (hmac[offset + 3] & 0xff);
    const totp = binaryCode % 1000000;
    return totp.toString().padStart(6, '0');
}

async function generateHMAC(secretKey, timeStep) {
    const msg = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        msg[7 - i] = timeStep & 0xff;
        timeStep >>= 8;
    }
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        secretKey,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msg);
    return new Uint8Array(signature);
}

function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalizedBase32 = base32.toUpperCase().replace(/=+$/, ''); // Remove padding if present
    const bits = [];
    for (const char of normalizedBase32) {
        const val = alphabet.indexOf(char);
        if (val === -1) {
            throw new Error('Invalid Base32 character in key.');
        }
        bits.push(...val.toString(2).padStart(5, '0').split('').map(Number));
    }
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        const byte = bits.slice(i, i + 8);
        if (byte.length === 8) {
            bytes.push(parseInt(byte.join(''), 2));
        }
    }
    return new Uint8Array(bytes);
}

