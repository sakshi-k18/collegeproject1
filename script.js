const lostBtn = document.getElementById("lostBtn");
const foundBtn = document.getElementById("foundBtn");
const form = document.getElementById("reportForm");
const formTitle = document.getElementById("formTitle");
const itemNameInput = document.getElementById("itemName");
const itemLocationInput = document.getElementById("itemLocation");
const itemDescInput = document.getElementById("itemDesc");
const itemContactInput = document.getElementById("itemContact");
const itemImageInput = document.getElementById("itemImage");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const feedbackMessage = document.getElementById("feedbackMessage");

const lostList = document.getElementById("lostList");
const foundList = document.getElementById("foundList");

let currentType = "lost";
let searchTerm = "";
let feedbackTimeoutId;

lostBtn.onclick = () => openForm("lost");
foundBtn.onclick = () => openForm("found");
searchInput.oninput = (event) => {
  searchTerm = event.target.value.trim();
  loadItems(searchTerm);
};
clearSearchBtn.onclick = () => {
  searchInput.value = "";
  searchTerm = "";
  loadItems();
};

function openForm(type) {
  currentType = type;
  formTitle.textContent =
    type === "lost" ? "Report Lost Item" : "Report Found Item";
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showFeedback(message, type = "success") {
  feedbackMessage.textContent = message;
  feedbackMessage.className = `feedback-message ${type}`;

  window.clearTimeout(feedbackTimeoutId);
  feedbackTimeoutId = window.setTimeout(() => {
    feedbackMessage.className = "feedback-message hidden";
    feedbackMessage.textContent = "";
  }, 3500);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let data = {};
  let isJson = false;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

   if (!response.ok && !isJson) {
    const compactBody = responseText.trim().replace(/\s+/g, " ").slice(0, 120);
    const nonJsonHint = compactBody
      ? `Server returned non-JSON (${response.status}) - ${compactBody}`
      : `Server returned non-JSON (${response.status}).`;
    throw new Error(nonJsonHint);
  }

  if (response.ok && responseText && !isJson) {
    const typeHint = contentType ? ` Content-Type: ${contentType}.` : "";
    throw new Error(`Unexpected API response format.${typeHint}`);
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

form.onsubmit = async function (e) {
  e.preventDefault();

  const file = itemImageInput.files[0];
  if (!file) {
    alert("Please choose an image before submitting.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async () => {
    const payload = {
      type: currentType,
      name: itemNameInput.value,
      location: itemLocationInput.value,
      desc: itemDescInput.value,
      contact: itemContactInput.value,
      image: reader.result,
      time: new Date().toLocaleString()
    };

    try {
      await fetchJson("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      form.reset();
      form.classList.add("hidden");
      showFeedback("Report saved to the database.");
      loadItems(searchTerm);
    } catch (error) {
      showFeedback(error.message, "error");
    }
  };

  reader.readAsDataURL(file);
};

function buildEmptyState(message) {
  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.textContent = message;
  return emptyState;
}

function buildItemCard(item) {
  const status = item.status || item.type;
  const shortDesc = item.desc.length > 120 ? `${item.desc.slice(0, 117)}...` : item.desc;
  const isResolved = status === "resolved";
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <img src="${item.image}" alt="${item.name}">
    <div class="card-content">
      <div class="card-topline">
        <p class="card-meta">Posted: ${item.time}</p>
        <span class="item-badge ${status}">${status}</span>
      </div>
      <h3>${item.name}</h3>
      <p>${shortDesc}</p>
      <p class="card-contact"><strong>Contact:</strong> ${item.contact}</p>
      <button type="button" data-id="${item.id}" ${isResolved ? "disabled" : ""}>
        ${isResolved ? "Claimed" : "Claim Item"}
      </button>
      <button type="button" data-id="${item.id}">Mark as Resolved</button>
    </div>
  `;

  div.querySelector("button").onclick = async () => {
    if (isResolved) {
      return;
    }

    try {
      await fetchJson(`/api/items/${item.id}/claim`, { method: "PATCH" });
      showFeedback("Item marked as claimed.");
      loadItems(searchTerm);
    } catch (error) {
      showFeedback(error.message, "error");
    }
  };

  return div;
}

function renderItems(items) {
  lostList.innerHTML = "";
  foundList.innerHTML = "";

  const lostItems = items.filter((item) => item.type === "lost");
  const foundItems = items.filter((item) => item.type === "found");

  if (lostItems.length === 0) {
    lostList.appendChild(
      buildEmptyState(
        searchTerm
          ? "No lost items match your search right now."
          : "No lost item reports yet. Use the form above to create one."
      )
    );
  } else {
    lostItems.forEach((item) => lostList.appendChild(buildItemCard(item)));
  }

  if (foundItems.length === 0) {
    foundList.appendChild(
      buildEmptyState(
        searchTerm
          ? "No found items match your search right now."
          : "No found item reports yet. Share one when you recover an item."
      )
    );
  } else {
    foundItems.forEach((item) => foundList.appendChild(buildItemCard(item)));
  }
}

async function loadItems(search = "") {
  try {
    const params = new URLSearchParams();
    if (search) {
      params.set("search", search);
    }

    const query = params.toString();
    const data = await fetchJson(`/api/items${query ? `?${query}` : ""}`);
    renderItems(data.items);
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

loadItems();

document.addEventListener("DOMContentLoaded", function () {
  const qrBtn = document.getElementById("qrBtn");
  const qrModal = document.getElementById("qrModal");
  const qrClose = document.getElementById("qrClose");

  if (!qrBtn || !qrModal || !qrClose) {
    console.error("QR elements not found");
    return;
  }

  qrBtn.onclick = function () {
    qrModal.classList.remove("hidden");
  };

  qrClose.onclick = function () {
    qrModal.classList.add("hidden");
  };

  qrModal.onclick = function (e) {
    if (e.target === qrModal) {
      qrModal.classList.add("hidden");
    }
  };
});