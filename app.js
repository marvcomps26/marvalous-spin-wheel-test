/* =========================================================
   MARVALOUS PREMIUM SPIN WHEEL
   COMPLETE CLEAN APP.JS
========================================================= */


/* =========================================================
   GOOGLE SHEET + CLAIM ENDPOINT
========================================================= */

const SETTINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlaiXI-x0C_wLvxmELI21rTu9uFR87MYtx9gqV_z_Z3hZ5nOCQBnb9No6i9MtZyqBD3c9wTo1tmz6x/pub?output=csv";

const CLAIM_URL =
  "https://script.google.com/macros/s/AKfycbwqv0mOcwHVa2AaGzvwMLjw-nqV4LonCg3-MXpDcgcMbhmw2ORo4JmO8JiCxXZkBScC/exec";


/* =========================================================
   TEST MODE

   true  = unlimited spins
   false = one spin per day
========================================================= */

const TEST_MODE = false;


/* =========================================================
   SOUNDS
========================================================= */

const spinSound =
  new Audio("./wheel-spin.mp3");

const celebrationSound =
  new Audio("./celebration.mp3");

spinSound.preload =
  "auto";

celebrationSound.preload =
  "auto";

spinSound.volume =
  0.60;

celebrationSound.volume =
  0.75;

spinSound.loop =
  false;

celebrationSound.loop =
  false;


/* =========================================================
   ELEMENTS
========================================================= */

const wheelFrame =
  document.querySelector(
    ".wheel-frame"
  );

const wheel =
  document.getElementById(
    "wheel"
  );

const spinButton =
  document.getElementById(
    "spinButton"
  );

const statusText =
  document.getElementById(
    "statusText"
  );

const recentWin =
  document.getElementById(
    "recentWin"
  );

const resultModal =
  document.getElementById(
    "resultModal"
  );

const resultTitle =
  document.getElementById(
    "resultTitle"
  );

const resultMessage =
  document.getElementById(
    "resultMessage"
  );

const closeResultButton =
  document.getElementById(
    "closeResultButton"
  );

const resultCloseX =
  document.getElementById(
    "resultCloseX"
  );

const wheelLabels =
  Array.from(
    document.querySelectorAll(
      ".wheel-label"
    )
  );


/* =========================================================
   GAME STATE
========================================================= */

let prizes =
  [];

let wheelPrizes =
  [];

let currentPrize =
  null;

let spinning =
  false;

let currentRotation =
  0;


/* =========================================================
   DAILY PLAY KEYS
========================================================= */

function getLocalDateKey() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}


const todayKey =
  getLocalDateKey();


const playKey =
  `marvalous_spin_played_${todayKey}`;


const resultKey =
  `marvalous_spin_result_${todayKey}`;


/* =========================================================
   CSV READER
========================================================= */

function csvSplit(row) {

  const matched =
    row.match(
      /(".*?"|[^",]+)(?=\s*,|\s*$)/g
    );

  return matched

    ? matched.map(
        value =>
          value
            .replace(
              /^"|"$/g,
              ""
            )
            .trim()
      )

    : [];
}


/* =========================================================
   LOAD SETTINGS FROM GOOGLE SHEET
========================================================= */

async function loadSettings() {

  setStatus(
    "Loading today’s wheel..."
  );


  if (spinButton) {

    spinButton.disabled =
      true;

  }


  try {

    const response =
      await fetch(
        `${SETTINGS_CSV_URL}&t=${Date.now()}`,
        {
          cache:
            "no-store"
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
        .split(
          /\r?\n/
        );


    prizes =
      [];


    /*
      GOOGLE SHEET LAYOUT

      Row 5 onwards:

      A = Prize
      B = Chance
      C = Claim type
      D = Minimum spend
      E = Expiry
      F = Code
    */

    for (
      let index = 4;
      index < lines.length;
      index++
    ) {

      if (
        !lines[index].trim()
      ) {

        continue;

      }


      const row =
        csvSplit(
          lines[index]
        );


      const prizeName =
        String(
          row[0] || ""
        ).trim();


      const chance =
        Number.parseFloat(
          row[1]
        );


      if (
        !prizeName ||
        Number.isNaN(
          chance
        )
      ) {

        continue;

      }


      prizes.push({

        prize:
          prizeName,

        chance:
          chance,

        claimType:
          String(
            row[2] || ""
          ).trim(),

        minSpend:
          String(
            row[3] || ""
          ).trim(),

        expiry:
          String(
            row[4] || ""
          ).trim(),

        code:
          String(
            row[5] || ""
          ).trim()

      });

    }


    if (
      !prizes.length
    ) {

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


    if (spinButton) {

      spinButton.disabled =
        true;

    }

  }
}


/* =========================================================
   PREPARE 8 WHEEL SEGMENTS
========================================================= */

function prepareWheelPrizes() {

  wheelPrizes =
    prizes.slice(
      0,
      8
    );


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


/* =========================================================
   UPDATE WHEEL LABELS
========================================================= */

function updateWheelLabels() {

  wheelLabels.forEach(
    (
      label,
      index
    ) => {

      const prize =
        wheelPrizes[
          index
        ];


      label.textContent =
        shortenWheelLabel(
          prize?.prize ||
          "TRY AGAIN"
        );

    }
  );
}


/* =========================================================
   SHORTEN LONG WHEEL TEXT
========================================================= */

function shortenWheelLabel(
  value
) {

  const text =
    String(
      value || ""
    ).trim();


  if (!text) {

    return "TRY AGAIN";

  }


  if (
    /try again/i.test(
      text
    )
  ) {

    return "TRY AGAIN";

  }


  if (
    /mystery/i.test(
      text
    )
  ) {

    return "MYSTERY";

  }


  if (
    /site credit/i.test(
      text
    )
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


  return (
    `${text.slice(0, 14)}…`
  );
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  message
) {

  if (!statusText) {

    return;

  }


  statusText.textContent =
    message;
}


/* =========================================================
   RESTORE DAILY STATE
========================================================= */

function restoreDailyState() {

  const savedResult =
    localStorage.getItem(
      resultKey
    );


  if (
    savedResult &&
    recentWin
  ) {

    recentWin.textContent =
      savedResult;

  }


  /*
    TEST MODE
  */

  if (TEST_MODE) {

    if (spinButton) {

      spinButton.disabled =
        false;

    }


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

    if (spinButton) {

      spinButton.disabled =
        true;

    }


    setStatus(
      "You’ve used today’s spin. Come back tomorrow."
    );


    return;
  }


  if (spinButton) {

    spinButton.disabled =
      false;

  }


  setStatus(
    "Your daily spin is ready"
  );
}


/* =========================================================
   PICK PRIZE USING SHEET ODDS
========================================================= */

function pickPrizeIndex() {

  const totalChance =
    wheelPrizes.reduce(
      (
        total,
        item
      ) => {

        return (
          total +
          Math.max(
            Number(
              item.chance || 0
            ),
            0
          )
        );

      },
      0
    );


  if (
    totalChance <= 0
  ) {

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

    roll -=
      Math.max(
        Number(
          wheelPrizes[
            index
          ].chance || 0
        ),
        0
      );


    if (
      roll <= 0
    ) {

      return index;

    }

  }


  return (
    wheelPrizes.length - 1
  );
}


/* =========================================================
   SOUND HELPERS
========================================================= */

function playSpinSound() {

  try {

    spinSound.pause();

    spinSound.currentTime =
      0;


    const playPromise =
      spinSound.play();


    if (
      playPromise !== undefined
    ) {

      playPromise.catch(
        error => {

          console.log(
            "Spin sound could not play:",
            error
          );

        }
      );

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

    spinSound.currentTime =
      0;

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

    celebrationSound.currentTime =
      0;


    const playPromise =
      celebrationSound.play();


    if (
      playPromise !== undefined
    ) {

      playPromise.catch(
        error => {

          console.log(
            "Celebration sound could not play:",
            error
          );

        }
      );

    }

  } catch (error) {

    console.log(
      "Celebration sound error:",
      error
    );

  }
}


/* =========================================================
   WHEEL LIGHT EFFECTS
========================================================= */

function startWheelEffects() {

  if (wheelFrame) {

    wheelFrame
      .classList
      .add(
        "spinning"
      );

  }
}


function stopWheelEffects() {

  if (wheelFrame) {

    wheelFrame
      .classList
      .remove(
        "spinning"
      );

  }
}


/* =========================================================
   RESET WHEEL TO NORMAL POSITION

   Happens after the result popup closes.
========================================================= */

function resetWheelPosition() {

  if (!wheel) {

    return;

  }


  wheel.style.transition =
    "none";


  wheel.style.transform =
    "rotate(0deg)";


  currentRotation =
    0;


  /*
    Force browser to register the reset
    before the next spin animation.
  */

  void wheel.offsetWidth;


  wheel.style.transition =
    "";

}


/* =========================================================
   SPIN WHEEL
========================================================= */

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

    if (spinButton) {

      spinButton.disabled =
        true;

    }


    setStatus(
      "You’ve already used today’s spin."
    );


    return;
  }


  if (
    !wheelPrizes.length
  ) {

    setStatus(
      "The prizes are still loading."
    );


    return;
  }


  spinning =
    true;


  if (spinButton) {

    spinButton.disabled =
      true;

  }


  startWheelEffects();


  setStatus(
    "The wheel is spinning..."
  );


  playSpinSound();


  /*
    Select winner before animation.
  */

  const winningIndex =
    pickPrizeIndex();


  currentPrize =
    wheelPrizes[
      winningIndex
    ];


  /*
    Eight segments = 45 degrees.
  */

  const segmentAngle =
    360 /
    wheelPrizes.length;


  const segmentCentre =
    (
      winningIndex *
      segmentAngle
    ) +
    (
      segmentAngle /
      2
    );


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
    7–9 full turns.
  */

  const extraTurns =
    7 +
    Math.floor(
      Math.random() *
      3
    );


  currentRotation +=
    (
      extraTurns *
      360
    ) +
    alignment;


  wheel.style.transition =
    "transform 5.4s cubic-bezier(0.10, 0.68, 0.08, 1)";


  wheel.style.transform =
    `rotate(${currentRotation}deg)`;


  if (
    navigator.vibrate
  ) {

    navigator.vibrate(
      18
    );

  }


  /*
    Lock play immediately in live mode.
  */

  if (!TEST_MODE) {

    localStorage.setItem(
      playKey,
      "yes"
    );

  }


  /*
    Result appears when wheel stops.
  */

  window.setTimeout(
    () => {

      stopSpinSound();

      stopWheelEffects();


      if (
        navigator.vibrate
      ) {

        navigator.vibrate(
          [
            20,
            35,
            45
          ]
        );

      }


      showResult();

    },
    5550
  );
}


/* =========================================================
   CHECK WHETHER PRIZE IS A WIN
========================================================= */

function isWinningPrize(
  prize
) {

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


/* =========================================================
   SHOW RESULT
========================================================= */

function showResult() {

  if (!currentPrize) {

    return;

  }


  const won =
    isWinningPrize(
      currentPrize
    );


  addStats(
    won
  );


  localStorage.setItem(
    resultKey,
    currentPrize.prize
  );


  if (recentWin) {

    recentWin.textContent =
      currentPrize.prize;

  }


  if (won) {

    showWinningResult();

    playCelebrationSound();

    launchConfetti();

  } else {

    showTryAgainResult();

  }


  if (resultModal) {

    resultModal
      .classList
      .add(
        "show"
      );


    resultModal.scrollTop =
      0;

  }


  spinning =
    false;


  if (TEST_MODE) {

    if (spinButton) {

      spinButton.disabled =
        false;

    }


    setStatus(
      "Test mode: spin again whenever you’re ready"
    );

  }
}


/* =========================================================
   WINNER POPUP

   IMPORTANT:
   The Marvalous logo is already inside
   .result-icon in index.html.

   JavaScript DOES NOT replace it.
========================================================= */

function showWinningResult() {

  if (resultTitle) {

    resultTitle.textContent =
      "You’re a winner!";

  }


  const minimumSpend =
    currentPrize.minSpend &&
    currentPrize.minSpend !== "0" &&
    String(
      currentPrize.minSpend
    )
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
    String(
      currentPrize.expiry
    )
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


    ${minimumSpend}


    ${expiry}


    <p class="claim-before-code-message">
      Enter your details below to claim
      your reward and reveal your code.
    </p>


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
        Reveal & claim reward
      </button>


      <p
        id="claimStatus"
        class="claim-status"
        aria-live="polite"
      ></p>


    </div>

  `;


  if (closeResultButton) {

    closeResultButton.style.display =
      "none";

  }


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
}


/* =========================================================
   TRY AGAIN RESULT
========================================================= */

function showTryAgainResult() {

  if (resultTitle) {

    resultTitle.textContent =
      "Better luck tomorrow";

  }


  /*
    Logo remains visible.
  */

  resultMessage.innerHTML = `
    <p>
      No reward on this spin.
      <br><br>
      Come back tomorrow for another
      free chance to discover a
      Marvalous reward.
    </p>
  `;


  if (closeResultButton) {

    closeResultButton.style.display =
      "block";


    closeResultButton.textContent =
      "Done";

  }
}


/* =========================================================
   SUBMIT WINNER CLAIM

   CODE STAYS HIDDEN UNTIL SUCCESS
========================================================= */

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
    nameInput
      .value
      .trim();


  const email =
    emailInput
      .value
      .trim();


  if (
    !name ||
    !email
  ) {

    claimStatus.textContent =
      "Please enter your name and email.";


    return;
  }


  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        email
      )
  ) {

    claimStatus.textContent =
      "Please enter a valid email address.";


    return;
  }


  claimButton.disabled =
    true;


  claimButton.textContent =
    "Saving claim...";


  claimStatus.textContent =
    "Saving your details...";


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
      CLAIM SUCCESSFUL.

      Code can now be shown.
    */

    if (resultTitle) {

      resultTitle.textContent =
        TEST_MODE
          ? "Test claim saved!"
          : "Claim saved!";

    }


    const revealedCode =
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

        : `
          <p class="claim-success-message">
            Your reward has been claimed successfully.
            We’ll apply it shortly.
          </p>
        `;


    resultMessage.innerHTML = `

      <p class="claim-success-message">
        Your details have been received 💜
      </p>

      ${revealedCode}

    `;


    if (closeResultButton) {

      closeResultButton.style.display =
        "block";


      closeResultButton.textContent =
        "Done";

    }


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


  } catch (error) {

    console.error(
      "Claim failed:",
      error
    );


    /*
      If logging fails,
      the code stays hidden.
    */

    claimButton.disabled =
      false;


    claimButton.textContent =
      "Reveal & claim reward";


    claimStatus.textContent =
      "Something went wrong. Please try again.";

  }
}


/* =========================================================
   COPY DISCOUNT CODE
========================================================= */

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


/* =========================================================
   LOCAL STATS
========================================================= */

function addStats(
  won
) {

  const plays =
    Number(
      localStorage.getItem(
        "marvalousSpinTotalPlays"
      ) || 0
    ) + 1;


  localStorage.setItem(
    "marvalousSpinTotalPlays",
    String(
      plays
    )
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
      String(
        wins
      )
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
    ).padStart(
      2,
      "0"
    ),

    String(
      yesterday.getDate()
    ).padStart(
      2,
      "0"
    )

  ].join(
    "-"
  );


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

    streak +=
      1;

  } else if (
    lastPlayDate !==
    todayKey
  ) {

    streak =
      1;

  }


  localStorage.setItem(
    "marvalousSpinStreak",
    String(
      streak
    )
  );


  localStorage.setItem(
    "marvalousSpinLastPlayDate",
    todayKey
  );
}


/* =========================================================
   CONFETTI
========================================================= */

function launchConfetti() {

  const colours = [

    "#f2c94c",

    "#fff1a8",

    "#bb3dff",

    "#ffffff",

    "#7c22d3",

    "#ffcf52"

  ];


  for (
    let index = 0;
    index < 90;
    index++
  ) {

    const piece =
      document.createElement(
        "span"
      );


    piece.className =
      "confetti-piece";


    piece.style.left =
      `${
        Math.random() *
        100
      }vw`;


    piece.style.top =
      `${
        -20 -
        Math.random() *
        100
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
        Math.random() *
        200 -
        100
      }px`
    );


    piece.style.animationDelay =
      `${
        Math.random() *
        0.45
      }s`;


    document.body.appendChild(
      piece
    );


    window.setTimeout(
      () => {

        piece.remove();

      },
      2600
    );

  }
}


/* =========================================================
   CLOSE RESULT
========================================================= */

function closeResult() {

  if (resultModal) {

    resultModal
      .classList
      .remove(
        "show"
      );


    resultModal.scrollTop =
      0;

  }


  /*
    Stop winner music if still playing.
  */

  celebrationSound.pause();

  celebrationSound.currentTime =
    0;


  /*
    Return wheel to its tidy upright
    starting position.
  */

  resetWheelPosition();


  if (TEST_MODE) {

    if (spinButton) {

      spinButton.disabled =
        false;

    }


    setStatus(
      "Test mode: spin again whenever you’re ready"
    );

  }
}


/* =========================================================
   RESULT MODAL EVENTS
========================================================= */

if (closeResultButton) {

  closeResultButton.addEventListener(
    "click",
    closeResult
  );

}


if (resultCloseX) {

  resultCloseX.addEventListener(
    "click",
    closeResult
  );

}


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


/* =========================================================
   VIEW ALL REWARDS
========================================================= */

const viewRewardsButton =
  document.querySelector(
    ".view-rewards-button"
  );

const rewardsModal =
  document.getElementById(
    "rewardsModal"
  );

const rewardsList =
  document.getElementById(
    "rewardsList"
  );

const rewardsCloseX =
  document.getElementById(
    "rewardsCloseX"
  );

const rewardsCloseButton =
  document.getElementById(
    "rewardsCloseButton"
  );


/* =========================================================
   BUILD REWARDS LIST
========================================================= */

function buildRewardsList() {

  if (!rewardsList) {

    return;

  }


  /*
    Don't show TRY AGAIN / NO PRIZE
    in the rewards popup.
  */

  const availableRewards =
    wheelPrizes.filter(
      prize => {

        const name =
          String(
            prize.prize || ""
          )
            .trim()
            .toUpperCase();


        return (

          name !==
            "TRY AGAIN" &&

          name !==
            "NO PRIZE"

        );

      }
    );


  /*
    Remove duplicates.
  */

  const uniqueRewards =
    [];

  const seenRewards =
    new Set();


  availableRewards.forEach(
    prize => {

      const key =
        String(
          prize.prize || ""
        )
          .trim()
          .toLowerCase();


      if (
        seenRewards.has(
          key
        )
      ) {

        return;

      }


      seenRewards.add(
        key
      );


      uniqueRewards.push(
        prize
      );

    }
  );


  if (
    !uniqueRewards.length
  ) {

    rewardsList.innerHTML = `
      <div class="reward-list-item">

        <div class="reward-list-icon">
          ✦
        </div>

        <div class="reward-list-copy">

          <strong>
            Rewards loading
          </strong>

          <small>
            Please wait a moment while
            today’s rewards load.
          </small>

        </div>

      </div>
    `;


    return;
  }


  rewardsList.innerHTML =
    uniqueRewards
      .map(
        prize => {

          const detailLines =
            [];


          if (
            prize.minSpend &&
            prize.minSpend !== "0" &&
            String(
              prize.minSpend
            )
              .toLowerCase() !== "none"
          ) {

            detailLines.push(
              `Minimum spend £${escapeHtml(
                prize.minSpend
              )}`
            );

          }


          if (
            prize.expiry &&
            String(
              prize.expiry
            )
              .toLowerCase() !== "none"
          ) {

            detailLines.push(
              `Valid for ${escapeHtml(
                prize.expiry
              )}`
            );

          }


          const detailText =
            detailLines.length

              ? detailLines.join(
                  " · "
                )

              : "Available on today’s wheel";


          return `
            <div class="reward-list-item">

              <div
                class="reward-list-icon"
                aria-hidden="true"
              >
                ★
              </div>

              <div class="reward-list-copy">

                <strong>
                  ${escapeHtml(
                    prize.prize
                  )}
                </strong>

                <small>
                  ${detailText}
                </small>

              </div>

            </div>
          `;

        }
      )
      .join("");
}


/* =========================================================
   OPEN REWARDS
========================================================= */

function openRewardsModal() {

  if (!rewardsModal) {

    return;

  }


  buildRewardsList();


  rewardsModal
    .classList
    .add(
      "show"
    );


  rewardsModal.scrollTop =
    0;


  document.body.style.overflow =
    "hidden";
}


/* =========================================================
   CLOSE REWARDS
========================================================= */

function closeRewardsModal() {

  if (!rewardsModal) {

    return;

  }


  rewardsModal
    .classList
    .remove(
      "show"
    );


  document.body.style.overflow =
    "";
}


/* =========================================================
   REWARDS EVENTS
========================================================= */

if (viewRewardsButton) {

  viewRewardsButton.addEventListener(
    "click",
    openRewardsModal
  );

}


if (rewardsCloseX) {

  rewardsCloseX.addEventListener(
    "click",
    closeRewardsModal
  );

}


if (rewardsCloseButton) {

  rewardsCloseButton.addEventListener(
    "click",
    closeRewardsModal
  );

}


if (rewardsModal) {

  rewardsModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        rewardsModal
      ) {

        closeRewardsModal();

      }

    }
  );

}


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }


    if (
      rewardsModal
        ?.classList
        .contains(
          "show"
        )
    ) {

      closeRewardsModal();

      return;

    }


    if (
      resultModal
        ?.classList
        .contains(
          "show"
        )
    ) {

      closeResult();

    }

  }
);


/* =========================================================
   SAFE DYNAMIC TEXT
========================================================= */

function escapeHtml(
  value = ""
) {

  return String(
    value
  ).replace(
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

    })[
      character
    ]
  );
}


/* =========================================================
   SPIN BUTTON EVENT
========================================================= */

if (spinButton) {

  spinButton.addEventListener(
    "click",
    spinWheel
  );

}


/* =========================================================
   START GAME
========================================================= */

loadSettings();
