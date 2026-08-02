const SETTINGS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlaiXI-x0C_wLvxmELI21rTu9uFR87MYtx9gqV_z_Z3hZ5nOCQBnb9No6i9MtZyqBD3c9wTo1tmz6x/pub?output=csv";

const CLAIM_URL =
  "https://script.google.com/macros/s/AKfycbwqv0mOcwHVa2AaGzvwMLjw-nqV4LonCg3-MXpDcgcMbhmw2ORo4JmO8JiCxXZkBScC/exec";


/* ELEMENTS */

const wheel = document.getElementById("wheel");
const spinButton = document.getElementById("spinButton");
const statusText = document.getElementById("statusText");
const recentWin = document.getElementById("recentWin");

const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const closeResultButton =
  document.getElementById("closeResultButton");
const resultCloseX =
  document.getElementById("resultCloseX");
const wheelLabels = Array.from(
  document.querySelectorAll(".wheel-label")
);


/* GAME STATE */

let prizes = [];
let wheelPrizes = [];
let currentPrize = null;

let spinning = false;
let currentRotation = 0;


/* DAILY PLAY KEY */

function getLocalDateKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}




/* CSV READER */

function csvSplit(row) {
  const matched = row.match(
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


/* LOAD PRIZES FROM GOOGLE SHEET */

async function loadSettings() {
  statusText.textContent = "Loading today’s wheel...";

  const TEST_MODE = true;

const todayKey = TEST_MODE
  ? "TEST"
  : getLocalDateKey();

const playKey =
  `marvalous_spin_played_${todayKey}`;

const resultKey =
  `marvalous_spin_result_${todayKey}`;.disabled = true;

  try {
    const response = await fetch(
      `${SETTINGS_CSV_URL}&t=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("Prize settings could not load.");
    }

    const text = await response.text();
    const lines = text.trim().split(/\r?\n/);

    prizes = [];

    /*
      This keeps the same layout as Ice Break.
      Prize rows begin on row 5 of the published sheet.
    */

    for (let index = 4; index < lines.length; index++) {
      if (!lines[index].trim()) continue;

      const row = csvSplit(lines[index]);

      const prizeName = (row[0] || "").trim();
      const chance = Number.parseFloat(row[1]);

      if (!prizeName || Number.isNaN(chance)) {
        continue;
      }

      prizes.push({
        prize: prizeName,
        chance,
        claimType: (row[2] || "").trim(),
        minSpend: (row[3] || "").trim(),
        expiry: (row[4] || "").trim(),
        code: (row[5] || "").trim()
      });
    }

    if (!prizes.length) {
      throw new Error("No prizes were found in the sheet.");
    }

    prepareWheelPrizes();
    updateWheelLabels();
    restoreDailyState();

  } catch (error) {
    console.error(error);

    statusText.textContent =
      "The wheel could not load. Please refresh and try again.";

    spinButton.disabled = true;
  }
}


/* CREATE THE EIGHT WHEEL SEGMENTS */

function prepareWheelPrizes() {
  /*
    The design has eight wheel sections.

    The first eight prize rows from the Google Sheet
    are displayed on the wheel.

    If the sheet has fewer than eight rows,
    the remaining sections become TRY AGAIN.
  */

  wheelPrizes = prizes.slice(0, 8);

  while (wheelPrizes.length < 8) {
    wheelPrizes.push({
      prize: "TRY AGAIN",
      chance: 0,
      claimType: "none",
      minSpend: "",
      expiry: "",
      code: ""
    });
  }
}


/* UPDATE WORDING ON THE WHEEL */

function updateWheelLabels() {
  wheelLabels.forEach((label, index) => {
    const prize = wheelPrizes[index];

    label.textContent = shortenWheelLabel(
      prize?.prize || "TRY AGAIN"
    );
  });
}

function shortenWheelLabel(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "TRY AGAIN";
  }

  if (text.length <= 16) {
    return text;
  }

  if (/try again/i.test(text)) {
    return "TRY AGAIN";
  }

  if (/mystery/i.test(text)) {
    return "MYSTERY";
  }

  if (/site credit/i.test(text)) {
    return text.replace(/site credit/i, "CREDIT");
  }

  return `${text.slice(0, 14)}…`;
}


/* RESTORE TODAY’S PLAY STATUS */

function restoreDailyState() {
  const hasPlayed = localStorage.getItem(playKey) === "yes";
  const savedResult = localStorage.getItem(resultKey);

  if (savedResult) {
    recentWin.textContent = savedResult;
  }

  if (!TEST_MODE && hasPlayed) {
  spinButton.disabled = true;

  statusText.textContent =
    "You’ve used today’s spin. Come back tomorrow.";

  return;
  }

  spinButton.disabled = false;

  statusText.textContent =
    "Your free daily spin is ready";
}


/* PICK A PRIZE USING THE SHEET ODDS */

function pickPrizeIndex() {
  const totalChance = wheelPrizes.reduce(
    (total, item) =>
      total + Math.max(Number(item.chance || 0), 0),
    0
  );

  if (totalChance <= 0) {
    return wheelPrizes.findIndex(item =>
      /try again/i.test(item.prize)
    );
  }

  let roll = Math.random() * totalChance;

  for (let index = 0; index < wheelPrizes.length; index++) {
    roll -= Math.max(
      Number(wheelPrizes[index].chance || 0),
      0
    );

    if (roll <= 0) {
      return index;
    }
  }

  return wheelPrizes.length - 1;
}


/* SPIN */

function spinWheel() {
  if (spinning) return;

  if (!TEST_MODE) {
  localStorage.setItem(playKey, "yes");
  }
    spinButton.disabled = true;

    statusText.textContent =
      "You’ve already used today’s spin.";

    return;
  }

  if (!wheelPrizes.length) {
    statusText.textContent =
      "The prizes are still loading.";

    return;
  }

  spinning = true;
  spinButton.disabled = true;

  statusText.textContent =
    "The wheel is spinning...";

  const winningIndex = pickPrizeIndex();

  currentPrize = wheelPrizes[winningIndex];

  const segmentAngle = 360 / wheelPrizes.length;

  const segmentCentre =
    winningIndex * segmentAngle +
    segmentAngle / 2;

  /*
    The pointer is fixed at the top.

    Rotate the selected segment so its centre
    finishes underneath the pointer.
  */

  const targetAngle =
    (360 - segmentCentre) % 360;

  const currentNormalised =
    ((currentRotation % 360) + 360) % 360;

  const alignment =
    (targetAngle - currentNormalised + 360) % 360;

  const extraTurns =
    7 + Math.floor(Math.random() * 3);

  currentRotation +=
    extraTurns * 360 +
    alignment;

  wheel.style.transition =
    "transform 5.4s cubic-bezier(0.10, 0.68, 0.08, 1)";

  wheel.style.transform =
    `rotate(${currentRotation}deg)`;

  localStorage.setItem(playKey, "yes");

  setTimeout(() => {
    showResult();
  }, 5550);
}


/* RESULT */

function isWinningPrize(prize) {
  if (!prize) return false;

  const name =
    String(prize.prize || "").toUpperCase();

  return (
    name !== "TRY AGAIN" &&
    name !== "NO PRIZE" &&
    prize.claimType !== "none"
  );
}

function showResult() {
  const won = isWinningPrize(currentPrize);

  addStats(won);

  localStorage.setItem(
    resultKey,
    currentPrize.prize
  );

  recentWin.textContent =
    currentPrize.prize;

  if (won) {
    showWinningResult();
    launchConfetti();
  } else {
    showTryAgainResult();
  }

  resultModal.classList.add("show");

  spinning = false;
}


/* WINNER POPUP */

function showWinningResult() {
  resultTitle.textContent = "You’re a winner!";

  const codeSection = currentPrize.code
    ? `
      <div class="claim-code-box">
        <span>Your discount code</span>

        <strong id="winningCode">
          ${escapeHtml(currentPrize.code)}
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
    currentPrize.minSpend.toLowerCase() !== "none"
      ? `
        <p class="claim-detail">
          Minimum spend: £${escapeHtml(
            currentPrize.minSpend
          )}
        </p>
      `
      : "";

  const expiry =
    currentPrize.expiry &&
    currentPrize.expiry.toLowerCase() !== "none"
      ? `
        <p class="claim-detail">
          Valid for: ${escapeHtml(
            currentPrize.expiry
          )}
        </p>
      `
      : "";

  resultMessage.innerHTML = `
    <strong class="claim-prize-name">
      ${escapeHtml(currentPrize.prize)}
    </strong>

    ${codeSection}
    ${minimumSpend}
    ${expiry}

    <div class="claim-form">
      <label for="claimName">Your name</label>

      <input
        id="claimName"
        type="text"
        autocomplete="name"
        placeholder="Full name"
      >

      <label for="claimEmail">Your email</label>

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

  closeResultButton.style.display = "none";

  const claimButton =
    document.getElementById("claimButton");

  claimButton.addEventListener(
    "click",
    submitClaim
  );

  const copyButton =
    document.getElementById("copyCodeButton");

  if (copyButton) {
    copyButton.addEventListener(
      "click",
      copyPrizeCode
    );
  }

  statusText.textContent =
    "Your prize has been revealed";
}


/* TRY AGAIN POPUP */

function showTryAgainResult() {
  resultTitle.textContent = "Better luck tomorrow";

  resultMessage.innerHTML = `
    No prize on today’s spin.
    <br><br>
    Come back tomorrow for another free chance
    to win a Marvalous reward.
  `;

  closeResultButton.style.display = "block";
  closeResultButton.textContent = "Done";

  statusText.textContent =
    "Your next free spin will be ready tomorrow";
}


/* CLAIM PRIZE */

async function submitClaim() {
  const nameInput =
    document.getElementById("claimName");

  const emailInput =
    document.getElementById("claimEmail");

  const claimButton =
    document.getElementById("claimButton");

  const claimStatus =
    document.getElementById("claimStatus");

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name || !email) {
    claimStatus.textContent =
      "Please enter your name and email.";

    return;
  }

  if (!email.includes("@")) {
    claimStatus.textContent =
      "Please enter a valid email address.";

    return;
  }

  claimButton.disabled = true;
  claimButton.textContent = "Sending...";

  claimStatus.textContent =
    "Sending your claim...";

  try {
    const response = await fetch(CLAIM_URL, {
      method: "POST",

      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },

      body: JSON.stringify({
        name,
        email,

        prize: currentPrize.prize,

        dailyCode:
          `SPIN-${todayKey}`,

        minSpend:
          currentPrize.minSpend || "",

        expiry:
          currentPrize.expiry || "",

        code:
          currentPrize.code || "",

        game:
          "Marv's Spin the Wheel"
      })
    });

    if (!response.ok) {
      throw new Error("Claim request failed.");
    }

    resultTitle.textContent = "Claim sent!";

    resultMessage.innerHTML = `
      Your prize claim has been logged
      successfully 💜
      <br><br>
      ${
        currentPrize.code
          ? "Your discount code is ready to use."
          : "We’ll check your claim and apply your reward shortly."
      }
    `;

    closeResultButton.style.display = "block";
    closeResultButton.textContent = "Done";

  } catch (error) {
    console.error(error);

    claimButton.disabled = false;
    claimButton.textContent = "Claim prize";

    claimStatus.textContent =
      "Something went wrong. Please try again.";
  }
}


/* COPY DISCOUNT CODE */

async function copyPrizeCode() {
  const button =
    document.getElementById("copyCodeButton");

  if (!currentPrize?.code) return;

  try {
    await navigator.clipboard.writeText(
      currentPrize.code
    );

    button.textContent = "Copied!";

  } catch (error) {
    console.error(error);

    button.textContent =
      currentPrize.code;
  }
}


/* STATS */

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

  const lastPlayDate =
    localStorage.getItem(
      "marvalousSpinLastPlayDate"
    );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, "0"),
    String(yesterday.getDate()).padStart(2, "0")
  ].join("-");

  let streak = Number(
    localStorage.getItem(
      "marvalousSpinStreak"
    ) || 0
  );

  if (lastPlayDate === yesterdayKey) {
    streak += 1;
  } else if (lastPlayDate !== todayKey) {
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
}


/* CONFETTI */

function launchConfetti() {
  const colours = [
    "#ffd45a",
    "#bb3dff",
    "#ff35c8",
    "#ffffff",
    "#7718ff"
  ];

  for (let index = 0; index < 85; index++) {
    const piece =
      document.createElement("span");

    piece.className = "confetti-piece";

    piece.style.left =
      `${Math.random() * 100}vw`;

    piece.style.top =
      `${-20 - Math.random() * 100}px`;

    piece.style.background =
      colours[
        Math.floor(
          Math.random() * colours.length
        )
      ];

    piece.style.setProperty(
      "--fall-x",
      `${Math.random() * 180 - 90}px`
    );

    piece.style.animationDelay =
      `${Math.random() * 0.4}s`;

    document.body.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 2500);
  }
}


/* MODAL */

function closeResult() {
  resultModal.classList.remove("show");
}

closeResultButton.addEventListener(
  "click",
  closeResult
);
resultCloseX.addEventListener(
  "click",
  closeResult
);
resultModal.addEventListener(
  "click",
  event => {
    if (event.target === resultModal) {
      closeResult();
    }
  }
);


/* SECURITY FOR DYNAMIC TEXT */

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]
  );
}


/* START */

spinButton.addEventListener(
  "click",
  spinWheel
);

loadSettings();
