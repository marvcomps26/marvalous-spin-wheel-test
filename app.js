/* =========================================
   MARVALOUS PREMIUM SPIN WHEEL
   FULL APP.JS REPLACEMENT
========================================= */


/* =========================================
   GOOGLE SHEET + CLAIM ENDPOINT
========================================= */

const SETTINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlaiXI-x0C_wLvxmELI21rTu9uFR87MYtx9gqV_z_Z3hZ5nOCQBnb9No6i9MtZyqBD3c9wTo1tmz6x/pub?output=csv";

const CLAIM_URL =
  "https://script.google.com/macros/s/AKfycbwqv0mOcwHVa2AaGzvwMLjw-nqV4LonCg3-MXpDcgcMbhmw2ORo4JmO8JiCxXZkBScC/exec";


/* =========================================
   TEST MODE

   true  = unlimited spins
   false = one spin per day
========================================= */

const TEST_MODE = true;

/* =========================================
   GAME SOUNDS
========================================= */

const spinSound =
  new Audio("wheel-spin.mp3");

const celebrationSound =
  new Audio("celebration.mp3");


spinSound.preload = "auto";
celebrationSound.preload = "auto";


spinSound.volume = 0.55;
celebrationSound.volume = 0.70;


/*
  Spin sound should stop itself when
  the wheel finishes rather than loop.
*/

spinSound.loop = false;
celebrationSound.loop = false;
/* =========================================
   ELEMENTS
========================================= */

const wheel =
  document.getElementById("wheel");

const spinButton =
  document.getElementById("spinButton");

const statusText =
  document.getElementById("statusText");

const recentWin =
  document.getElementById("recentWin");

const resultModal =
  document.getElementById("resultModal");

const resultTitle =
  document.getElementById("resultTitle");

const resultMessage =
  document.getElementById("resultMessage");

const closeResultButton =
  document.getElementById("closeResultButton");

const resultCloseX =
  document.getElementById("resultCloseX");

const resultIcon =
  document.querySelector(".result-icon");

const wheelLabels =
  Array.from(
    document.querySelectorAll(".wheel-label")
  );


/* =========================================
   GAME STATE
========================================= */

let prizes = [];

let wheelPrizes = [];

let currentPrize = null;

let spinning = false;

let currentRotation = 0;


/* =========================================
   DAILY PLAY KEYS
========================================= */

function getLocalDateKey() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


const todayKey =
  getLocalDateKey();

const playKey =
  `marvalous_spin_played_${todayKey}`;

const resultKey =
  `marvalous_spin_result_${todayKey}`;


/* =========================================
   CSV READER
========================================= */

function csvSplit(row) {
  const matched =
    row.match(
      /(".*?"|[^",]+)(?=\s*,|\s*$)/g
    );

  return matched
    ? matched.map(value =>
        value
          .replace(/^"|"$/g, "")
          .trim()
      )
    : [];
}


/* =========================================
   LOAD PRIZES FROM GOOGLE SHEET
========================================= */

async function loadSettings() {
  setStatus(
    "Loading today’s wheel..."
  );

  spinButton.disabled = true;

  try {
    const response =
      await fetch(
        `${SETTINGS_CSV_URL}&t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Prize settings could not load."
      );
    }

    const text =
      await response.text();

    const lines =
      text
        .trim()
        .split(/\r?\n/);

    prizes = [];


    /*
      SAME SHEET LAYOUT AS BEFORE

      Prize rows begin on row 5

      Column A = Prize
      Column B = Chance
      Column C = Claim type
      Column D = Minimum spend
      Column E = Expiry
      Column F = Code
    */

    for (
      let index = 4;
      index < lines.length;
      index++
    ) {

      if (!lines[index].trim()) {
        continue;
      }


      const row =
        csvSplit(
          lines[index]
        );


      const prizeName =
        (row[0] || "")
          .trim();


      const chance =
        Number.parseFloat(
          row[1]
        );


      if (
        !prizeName ||
        Number.isNaN(chance)
      ) {
        continue;
      }


      prizes.push({
        prize:
          prizeName,

        chance:
          chance,

        claimType:
          (row[2] || "")
            .trim(),

        minSpend:
          (row[3] || "")
            .trim(),

        expiry:
          (row[4] || "")
            .trim(),

        code:
          (row[5] || "")
            .trim()
      });

    }


    if (!prizes.length) {
      throw new Error(
        "No prizes were found in the sheet."
      );
    }


    prepareWheelPrizes();

    updateWheelLabels();

    restoreDailyState();


  } catch (error) {

    console.error(
      "Wheel settings failed:",
      error
    );


    setStatus(
      "The wheel could not load. Please refresh and try again."
    );

    spinButton.disabled = true;

  }
}


/* =========================================
   PREPARE 8 WHEEL SEGMENTS
========================================= */

function prepareWheelPrizes() {
  wheelPrizes =
    prizes.slice(0, 8);


  while (
    wheelPrizes.length < 8
  ) {

    wheelPrizes.push({
      prize:
        "TRY AGAIN",

      chance:
        0,

      claimType:
        "none",

      minSpend:
        "",

      expiry:
        "",

      code:
        ""
    });

  }
}


/* =========================================
   UPDATE WHEEL LABELS
========================================= */

function updateWheelLabels() {

  wheelLabels.forEach(
    (label, index) => {

      const prize =
        wheelPrizes[index];


      label.textContent =
        shortenWheelLabel(
          prize?.prize ||
          "TRY AGAIN"
        );


      /*
        Optional styling hook
        for gold segments.
      */

      label.dataset.segment =
        String(index + 1);

    }
  );
}


/* =========================================
   SHORTEN LABEL TEXT
========================================= */

function shortenWheelLabel(value) {

  const text =
    String(value || "")
      .trim();


  if (!text) {
    return "TRY AGAIN";
  }


  if (
    /try again/i.test(text)
  ) {
    return "TRY AGAIN";
  }


  if (
    /mystery/i.test(text)
  ) {
    return "MYSTERY";
  }


  if (
    /site credit/i.test(text)
  ) {

    return text.replace(
      /site credit/i,
      "CREDIT"
    );

  }


  if (
    text.length <= 16
  ) {
    return text;
  }


  return `${text.slice(0, 14)}…`;
}


/* =========================================
   RESTORE DAILY STATE
========================================= */

function restoreDailyState() {

  const savedResult =
    localStorage.getItem(
      resultKey
    );


  if (savedResult) {
    recentWin.textContent =
      savedResult;
  }


  /*
    TEST MODE
  */

  if (TEST_MODE) {

    spinButton.disabled = false;

    setStatus(
      "Test mode: unlimited spins enabled"
    );

    return;

  }


  /*
    LIVE MODE
  */

  const hasPlayed =
    localStorage.getItem(
      playKey
    ) === "yes";


  if (hasPlayed) {

    spinButton.disabled = true;

    setStatus(
      "You’ve used today’s spin. Come back tomorrow."
    );

    return;

  }


  spinButton.disabled = false;

  setStatus(
    "Your daily spin is ready"
  );
}


/* =========================================
   STATUS HELPER
========================================= */

function setStatus(message) {

  if (!statusText) {
    return;
  }

  statusText.textContent =
    message;
}


/* =========================================
   PICK PRIZE USING SHEET ODDS
========================================= */

function pickPrizeIndex() {

  const totalChance =
    wheelPrizes.reduce(
      (total, item) =>
        total +
        Math.max(
          Number(
            item.chance || 0
          ),
          0
        ),
      0
    );


  if (totalChance <= 0) {

    const tryAgainIndex =
      wheelPrizes.findIndex(
        item =>
          /try again/i.test(
            item.prize
          )
      );


    return (
      tryAgainIndex >= 0
        ? tryAgainIndex
        : 0
    );

  }


  let roll =
    Math.random() *
    totalChance;


  for (
    let index = 0;
    index < wheelPrizes.length;
    index++
  ) {

    roll -= Math.max(
      Number(
        wheelPrizes[index]
          .chance || 0
      ),
      0
    );


    if (roll <= 0) {
      return index;
    }

  }


  return (
    wheelPrizes.length - 1
  );
}

/* =========================================
   SOUND HELPERS
========================================= */

function playSpinSound() {

  try {

    spinSound.pause();

    spinSound.currentTime = 0;

    const playPromise =
      spinSound.play();

    if (
      playPromise !== undefined
    ) {

      playPromise.catch(error => {

        console.log(
          "Spin sound could not play:",
          error
        );

      });

    }

  } catch (error) {

    console.log(
      "Spin sound error:",
      error
    );

  }
}


function stopSpinSound() {

  try {

    spinSound.pause();

    spinSound.currentTime = 0;

  } catch (error) {

    console.log(
      "Could not stop spin sound:",
      error
    );

  }

}


function playCelebrationSound() {

  try {

    celebrationSound.pause();

    celebrationSound.currentTime = 0;

    const playPromise =
      celebrationSound.play();

    if (
      playPromise !== undefined
    ) {

      playPromise.catch(error => {

        console.log(
          "Celebration sound could not play:",
          error
        );

      });

    }

  } catch (error) {

    console.log(
      "Celebration sound error:",
      error
    );

  }

}

/* =========================================
   SPIN WHEEL
========================================= */

function spinWheel() {

  if (spinning) {
    return;
  }


  if (
    !TEST_MODE &&
    localStorage.getItem(
      playKey
    ) === "yes"
  ) {

    spinButton.disabled = true;

    setStatus(
      "You’ve already used today’s spin."
    );

    return;

  }


  if (!wheelPrizes.length) {

    setStatus(
      "The prizes are still loading."
    );

    return;

  }


  spinning = true;

  spinButton.disabled = true;


  setStatus(
    "The wheel is spinning..."
  );
playSpinSound();

  /*
    Choose winning prize BEFORE
    animation starts.
  */

  const winningIndex =
    pickPrizeIndex();


  currentPrize =
    wheelPrizes[
      winningIndex
    ];


  const segmentAngle =
    360 /
    wheelPrizes.length;


  /*
    Centre of selected segment.
  */

  const segmentCentre =
    winningIndex *
      segmentAngle +
    segmentAngle / 2;


  /*
    Pointer sits at 12 o'clock.
  */

  const targetAngle =
    (
      360 -
      segmentCentre
    ) % 360;


  const currentNormalised =
    (
      (
        currentRotation %
        360
      ) +
      360
    ) % 360;


  const alignment =
    (
      targetAngle -
      currentNormalised +
      360
    ) % 360;


  /*
    7–9 complete turns.
  */

  const extraTurns =
    7 +
    Math.floor(
      Math.random() * 3
    );


  currentRotation +=
    extraTurns * 360 +
    alignment;


  /*
    Premium easing.
  */

  wheel.style.transition =
    "transform 5.4s cubic-bezier(0.10, 0.68, 0.08, 1)";


  wheel.style.transform =
    `rotate(${currentRotation}deg)`;


  /*
    Optional phone vibration
    at start.
  */

  if (
    navigator.vibrate
  ) {
    navigator.vibrate(18);
  }


  /*
    Store play immediately
    in live mode.
  */

  if (!TEST_MODE) {

    localStorage.setItem(
      playKey,
      "yes"
    );

  }


  /*
    Show result after wheel stops.
  */

window.setTimeout(
  () => {

    stopSpinSound();

    if (
      navigator.vibrate
    ) {

      navigator.vibrate(
        [20, 35, 45]
      );

    }

    showResult();

  },
  5550
);  
}

/* =========================================
   CHECK WHETHER RESULT IS A WIN
========================================= */

function isWinningPrize(prize) {

  if (!prize) {
    return false;
  }


  const name =
    String(
      prize.prize || ""
    )
      .trim()
      .toUpperCase();


  const claimType =
    String(
      prize.claimType || ""
    )
      .trim()
      .toLowerCase();


  return (
    name !== "TRY AGAIN" &&
    name !== "NO PRIZE" &&
    claimType !== "none"
  );
}


/* =========================================
   SHOW RESULT
========================================= */

function showResult() {

  if (!currentPrize) {
    return;
  }


  const won =
    isWinningPrize(
      currentPrize
    );


  addStats(won);


  localStorage.setItem(
    resultKey,
    currentPrize.prize
  );


  recentWin.textContent =
    currentPrize.prize;


  if (won) {

  showWinningResult();

  playCelebrationSound();

  launchConfetti();

} else {

  showTryAgainResult();

  }


  resultModal.classList.add(
    "show"
  );


  spinning = false;


  /*
    Test mode unlocks again.
  */

  if (TEST_MODE) {

    spinButton.disabled = false;

    setStatus(
      "Test mode: spin again whenever you’re ready"
    );

  }
}


/* =========================================
   WINNING RESULT
========================================= */

function showWinningResult() {

  resultTitle.textContent =
    "You’re a winner!";


  /*
    Gold star for winning result.
  */

  if (resultIcon) {
    resultIcon.textContent =
      "★";
  }


  const codeSection =
    currentPrize.code
      ? `
        <div class="claim-code-box">

          <span>
            Your discount code
          </span>

          <strong id="winningCode">
            ${escapeHtml(
              currentPrize.code
            )}
          </strong>

          <button
            id="copyCodeButton"
            type="button"
            class="claim-copy-button"
          >
            Copy code
          </button>

        </div>
      `
      : "";


  const minimumSpend =
    currentPrize.minSpend &&
    currentPrize.minSpend !== "0" &&
    currentPrize.minSpend
      .toLowerCase() !== "none"
      ? `
        <p class="claim-detail">
          Minimum spend:
          £${escapeHtml(
            currentPrize.minSpend
          )}
        </p>
      `
      : "";


  const expiry =
    currentPrize.expiry &&
    currentPrize.expiry
      .toLowerCase() !== "none"
      ? `
        <p class="claim-detail">
          Valid for:
          ${escapeHtml(
            currentPrize.expiry
          )}
        </p>
      `
      : "";


  resultMessage.innerHTML = `

    <strong class="claim-prize-name">
      ${escapeHtml(
        currentPrize.prize
      )}
    </strong>

    ${codeSection}

    ${minimumSpend}

    ${expiry}


    <div class="claim-form">

      <label for="claimName">
        Your name
      </label>

      <input
        id="claimName"
        type="text"
        autocomplete="name"
        placeholder="Full name"
      >


      <label for="claimEmail">
        Your email
      </label>

      <input
        id="claimEmail"
        type="email"
        autocomplete="email"
        placeholder="Email address"
      >


      <button
        id="claimButton"
        type="button"
        class="claim-submit-button"
      >
        Claim prize
      </button>


      <p
        id="claimStatus"
        class="claim-status"
        aria-live="polite"
      ></p>

    </div>
  `;


  /*
    Hide standard Continue button
    until claim succeeds.
  */

  closeResultButton.style.display =
    "none";


  /*
    Claim button listener.
  */

  const claimButton =
    document.getElementById(
      "claimButton"
    );


  if (claimButton) {

    claimButton.addEventListener(
      "click",
      submitClaim
    );

  }


  /*
    Copy button listener.
  */

  const copyButton =
    document.getElementById(
      "copyCodeButton"
    );


  if (copyButton) {

    copyButton.addEventListener(
      "click",
      copyPrizeCode
    );

  }
}


/* =========================================
   TRY AGAIN RESULT
========================================= */

function showTryAgainResult() {

  resultTitle.textContent =
    "Better luck tomorrow";


  if (resultIcon) {
    resultIcon.textContent =
      "✦";
  }


  resultMessage.innerHTML = `
    <p>
      No reward on this spin.
      <br><br>
      Come back tomorrow for another
      free chance to discover a
      Marvalous reward.
    </p>
  `;


  closeResultButton.style.display =
    "block";


  closeResultButton.textContent =
    "Done";
}


/* =========================================
   SUBMIT WINNER CLAIM
========================================= */

async function submitClaim() {

  const nameInput =
    document.getElementById(
      "claimName"
    );


  const emailInput =
    document.getElementById(
      "claimEmail"
    );


  const claimButton =
    document.getElementById(
      "claimButton"
    );


  const claimStatus =
    document.getElementById(
      "claimStatus"
    );


  if (
    !nameInput ||
    !emailInput ||
    !claimButton ||
    !claimStatus
  ) {
    return;
  }


  const name =
    nameInput.value.trim();


  const email =
    emailInput.value.trim();


  /*
    Required fields.
  */

  if (
    !name ||
    !email
  ) {

    claimStatus.textContent =
      "Please enter your name and email.";

    return;

  }


  /*
    Basic email check.
  */

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {

    claimStatus.textContent =
      "Please enter a valid email address.";

    return;

  }


  claimButton.disabled = true;


  claimButton.textContent =
    "Sending...";


  claimStatus.textContent =
    "Sending your claim...";


  try {

    const response =
      await fetch(
        CLAIM_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body:
            JSON.stringify({

              name:
                name,

              email:
                email,

              prize:
                currentPrize.prize,

              dailyCode:
                TEST_MODE
                  ? `SPIN-TEST-${todayKey}`
                  : `SPIN-${todayKey}`,

              minSpend:
                currentPrize.minSpend || "",

              expiry:
                currentPrize.expiry || "",

              code:
                currentPrize.code || "",

              game:
                "Marv's Spin the Wheel",

              testMode:
                TEST_MODE
            })
        }
      );


    if (!response.ok) {

      throw new Error(
        "Claim request failed."
      );

    }


    /*
      SUCCESS
    */

    resultTitle.textContent =
      TEST_MODE
        ? "Test claim sent!"
        : "Claim sent!";


    if (resultIcon) {
      resultIcon.textContent =
        "✓";
    }


    resultMessage.innerHTML = `
      <p>
        Your prize claim has been
        logged successfully 💜
        <br><br>

        ${
          currentPrize.code
            ? "Your discount code is ready to use."
            : "We’ll check your claim and apply your reward shortly."
        }
      </p>
    `;


    closeResultButton.style.display =
      "block";


    closeResultButton.textContent =
      "Done";


  } catch (error) {

    console.error(
      "Claim failed:",
      error
    );


    claimButton.disabled = false;


    claimButton.textContent =
      "Claim prize";


    claimStatus.textContent =
      "Something went wrong. Please try again.";

  }
}


/* =========================================
   COPY DISCOUNT CODE
========================================= */

async function copyPrizeCode() {

  const button =
    document.getElementById(
      "copyCodeButton"
    );


  if (
    !currentPrize?.code
  ) {
    return;
  }


  try {

    await navigator.clipboard
      .writeText(
        currentPrize.code
      );


    if (button) {

      button.textContent =
        "Copied!";

    }


    window.setTimeout(
      () => {

        if (button) {
          button.textContent =
            "Copy code";
        }

      },
      1800
    );


  } catch (error) {

    console.error(
      "Copy failed:",
      error
    );


    if (button) {

      button.textContent =
        currentPrize.code;

    }

  }
}


/* =========================================
   LOCAL STATS
========================================= */

function addStats(won) {

  const plays =
    Number(
      localStorage.getItem(
        "marvalousSpinTotalPlays"
      ) || 0
    ) + 1;


  localStorage.setItem(
    "marvalousSpinTotalPlays",
    String(plays)
  );


  if (won) {

    const wins =
      Number(
        localStorage.getItem(
          "marvalousSpinTotalWins"
        ) || 0
      ) + 1;


    localStorage.setItem(
      "marvalousSpinTotalWins",
      String(wins)
    );

  }


  const lastPlayDate =
    localStorage.getItem(
      "marvalousSpinLastPlayDate"
    );


  const yesterday =
    new Date();


  yesterday.setDate(
    yesterday.getDate() - 1
  );


  const yesterdayKey = [
    yesterday.getFullYear(),

    String(
      yesterday.getMonth() + 1
    ).padStart(2, "0"),

    String(
      yesterday.getDate()
    ).padStart(2, "0")
  ].join("-");


  let streak =
    Number(
      localStorage.getItem(
        "marvalousSpinStreak"
      ) || 0
    );


  if (
    lastPlayDate ===
    yesterdayKey
  ) {

    streak += 1;

  } else if (
    lastPlayDate !==
    todayKey
  ) {

    streak = 1;

  }


  localStorage.setItem(
    "marvalousSpinStreak",
    String(streak)
  );


  localStorage.setItem(
    "marvalousSpinLastPlayDate",
    todayKey
  );
}


/* =========================================
   CONFETTI
========================================= */

function launchConfetti() {

  const colours = [
    "#e6bf5d",
    "#fff1b4",
    "#7b2ab9",
    "#ffffff",
    "#c99735"
  ];


  for (
    let index = 0;
    index < 75;
    index++
  ) {

    const piece =
      document.createElement(
        "span"
      );


    piece.className =
      "confetti-piece";


    piece.style.left =
      `${Math.random() * 100}vw`;


    piece.style.top =
      `${
        -20 -
        Math.random() * 100
      }px`;


    piece.style.background =
      colours[
        Math.floor(
          Math.random() *
          colours.length
        )
      ];


    piece.style.setProperty(
      "--fall-x",
      `${
        Math.random() * 180 -
        90
      }px`
    );


    piece.style.animationDelay =
      `${
        Math.random() *
        0.4
      }s`;


    piece.style.transform =
      `rotate(${
        Math.random() * 180
      }deg)`;


    document.body.appendChild(
      piece
    );


    window.setTimeout(
      () => {
        piece.remove();
      },
      2500
    );

  }
}


/* =========================================
   MODAL
========================================= */

function closeResult() {

  resultModal.classList.remove(
    "show"
  );


  /*
    Reset modal scroll.
  */

  resultModal.scrollTop = 0;


  /*
    Test mode can spin again.
  */

  if (TEST_MODE) {

    spinButton.disabled = false;

    setStatus(
      "Test mode: spin again whenever you’re ready"
    );

  }
}


/* =========================================
   MODAL BUTTON EVENTS
========================================= */

if (closeResultButton) {

  closeResultButton
    .addEventListener(
      "click",
      closeResult
    );

}


if (resultCloseX) {

  resultCloseX
    .addEventListener(
      "click",
      closeResult
    );

}


/*
  Tap dark backdrop to close.
*/

if (resultModal) {

  resultModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        resultModal
      ) {

        closeResult();

      }

    }
  );

}


/*
  Escape key closes modal
  on desktop.
*/

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      resultModal.classList
        .contains("show")
    ) {

      closeResult();

    }

  }
);


/* =========================================
   SAFE DYNAMIC TEXT
========================================= */

function escapeHtml(value = "") {

  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&":
        "&amp;",

      "<":
        "&lt;",

      ">":
        "&gt;",

      '"':
        "&quot;",

      "'":
        "&#039;"
    })[character]
  );
}


/* =========================================
   START
========================================= */

spinButton.addEventListener(
  "click",
  spinWheel
);


loadSettings();
