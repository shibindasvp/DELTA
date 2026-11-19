const timerElement = document.getElementById("timer");
const resendButton = document.getElementById("resendBtn");

if (timerElement && resendButton) {
    let seconds = 60;

    const interval = setInterval(() => {
        seconds--;

        timerElement.textContent =
            `Resend available in ${seconds} seconds`;

        if (seconds <= 0) {
            clearInterval(interval);
            timerElement.textContent =
                "You can resend OTP now";
            resendButton.disabled = false;
        }
    }, 1000);
}
