const lostBtn = document.getElementById("lostBtn");
const foundBtn = document.getElementById("foundBtn");
const form = document.getElementById("reportForm");
const formTitle = document.getElementById("formTitle");

const lostList = document.getElementById("lostList");
const foundList = document.getElementById("foundList");

let currentType = "lost";

lostBtn.onclick = () => openForm("lost");
foundBtn.onclick = () => openForm("found");

function openForm(type) {
  currentType = type;
  formTitle.textContent =
    type === "lost" ? "Report Lost Item" : "Report Found Item";
  form.classList.remove("hidden");
}

form.onsubmit = function (e) {
  e.preventDefault();

  const reader = new FileReader();
  const file = itemImage.files[0];

  reader.onload = () => {

    const now = new Date();

    const item = {
      type: currentType,
      name: itemName.value,
      location: itemLocation.value,
      desc: itemDesc.value,
      contact: itemContact.value,
      image: reader.result,
      time: now.toLocaleString()
    };

    const items = JSON.parse(localStorage.getItem("items")) || [];
    items.push(item);
    localStorage.setItem("items", JSON.stringify(items));

    form.reset();
    form.classList.add("hidden");
    renderItems();
  };

  reader.readAsDataURL(file);
};

function renderItems() {
  lostList.innerHTML = "";
  foundList.innerHTML = "";

  const items = JSON.parse(localStorage.getItem("items")) || [];

  items.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${item.image}">
      <h4>${item.name}</h4>
      <p>${item.desc}</p>
      <p><b>Location:</b> ${item.location}</p>
      <p><b>Contact:</b> ${item.contact}</p>
      <p style="font-size: 12px; color: gray;">
        Reported on: ${item.time}
      </p>
      <button onclick="removeItem(${index})">Mark as Resolved</button>
    `;

    if (item.type === "lost") {
      lostList.appendChild(div);
    } else {
      foundList.appendChild(div);
    }
  });
}

function removeItem(index) {
  const items = JSON.parse(localStorage.getItem("items")) || [];
  items.splice(index, 1);
  localStorage.setItem("items", JSON.stringify(items));
  renderItems();
}

renderItems();
