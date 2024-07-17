const menu = document.getElementById('hamburger-menu');
const closeMenuBtn = document.getElementById('close-menu');
const menuItemsDiv = document.getElementById('menu-items');

// menu-items

menu.addEventListener('click', ()=>{
    // alert('open')
    menuItemsDiv.classList.remove("right-[100%]");
    menuItemsDiv.classList.remove('absolute')
    menuItemsDiv.classList.add('fixed')

    // menu.classList.remove('bg-orange-300')
    // close-menu
})

closeMenuBtn.addEventListener('click', ()=>{
    menuItemsDiv.classList.add("right-[100%]");
    menuItemsDiv.classList.remove('fixed')
    menuItemsDiv.classList.add('absolute')
    // alert('closed')
    // close-menu
})


// document.addEventListener('DOMContentLoaded', function () {
//     let slideIndex = 1;
//     showSlides(slideIndex);
  
//     document.getElementById('prevBtn').addEventListener('click', function () {
//       showSlides(slideIndex -= 1);
//     });
  
//     document.getElementById('nextBtn').addEventListener('click', function () {
//       showSlides(slideIndex += 1);
//     });
  
//     // Auto slide every 1000 milliseconds (1 second)
//     setInterval(function () {
//       showSlides(slideIndex += 1);
//     }, 2000);
  
    
//     function showSlides(n) {
//       let i;
//       const slides = document.getElementsByClassName('carousel-item');
  
//       if (n > slides.length) {
//         slideIndex = 1;
//       }
//       if (n < 1) {
//         slideIndex = slides.length;
//       }
  
//       for (i = 0; i < slides.length; i++) {
//         slides[i].style.display = 'none';
//       }
  
//       slides[slideIndex - 1].style.display = 'block';
//     }
//   });
  

document.addEventListener('DOMContentLoaded', function () {
    let slideIndex = 0;
    showSlides(slideIndex);
  
    document.getElementById('prevBtn').addEventListener('click', function () {
      showSlides(slideIndex -= 1);
    });
  
    document.getElementById('nextBtn').addEventListener('click', function () {
      showSlides(slideIndex += 1);
    });
  
    function showSlides(n) {
      const slides = document.querySelectorAll('.carousel-item');
      
      if (n >= slides.length) {
        slideIndex = 0;
      }
  
      if (n < 0) {
        slideIndex = slides.length - 1;
      }
  
      const transformValue = `translateX(${-slideIndex * 100}%)`;
      document.querySelector('.carousel-inner').style.transform = transformValue;
    }
  
    // Auto slide every 2000 milliseconds (2 seconds)
    setInterval(function () {
      showSlides(slideIndex += 1);
    }, 2000);
  });
  

  function submitForm() {
    const form = document.getElementById('contactForm');

    // Create FormData object from the form
    const formData = new FormData(form);

    // Fetch API to send the form data
    fetch('https://formsubmit.co/dc9643cac2392262fbabc84cde6693eb', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        document.getElementById('responseMessage').innerHTML = '<p class="text-green-500">Form submitted successfully!</p>';

        location.reload('http://localhost:5500/')
        // You can handle success response here, like displaying a success message
    })
    .catch((error) => {
        console.error('Error:', error);
        // Handle error here, like displaying an error message
    });
}


// path/to/your/script.js

document.addEventListener('DOMContentLoaded', function () {
  const welcomeContainer = document.getElementById('welcomeContainer');
  const closeButton = document.getElementById('closeButton');

  // Show the welcome container
  welcomeContainer.classList.remove('hidden');

  // Close the welcome container after 10 seconds
  // setTimeout(() => {
  //     welcomeContainer.classList.add('hidden');
  // }, 10000);

  // Add an event listener to the close button
  closeButton.addEventListener('click', function () {
      welcomeContainer.classList.add('hidden');
  });
});

document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.message').style.display = 'block';
});

setTimeout(function() {
  document.querySelector('.message').style.display = 'none';
}, 120 * 1000);

function updateVisitCount() {
  let count = localStorage.getItem('visitCount');
  count = count ? parseInt(count) + 1 : 1;
  localStorage.setItem('visitCount', count);
  document.getElementById('visitCount').textContent = `Visitors: ${count}`;
}

// Update visit count on page load
document.addEventListener('DOMContentLoaded', function() {
  updateVisitCount();
});