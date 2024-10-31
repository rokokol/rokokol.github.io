const carouselInner = document.querySelector('.carousel-inner');
let currentIndex = 0;
let isDragging = false;
let startX = 0;
let currentX = 0;
let projects = [];
let filteredProjects = [];
let tags = [];
let selectedTags = []; // Массив выбранных тегов
let velocity = 0;
let animationFrameId = null;

// Настраиваемые параметры чувствительности
const swipeThreshold = 30;
const velocityThreshold = 5;
const friction = 0.50;
const minVelocity = 0.3;
const wheelThrottleTimeout = 100;

// Флаг для throttling колесика мыши
let isThrottled = false;

// Загрузка данных о проектах
fetch('projects.json')
    .then(response => response.json())
    .then(data => {
        projects = data;
        filteredProjects = [...projects];

        // Генерируем список уникальных тегов из проектов
        tags = getUniqueTagsFromProjects(projects);

        // Отображаем теги на странице
        displayTags();

        // Отображаем проекты
        displayProjects();

        // Устанавливаем текущий индекс на средний проект
        currentIndex = Math.floor(filteredProjects.length / 2);
        updateCarousel();

        // Добавляем обработчики событий
        addEventListeners();
    })
    .catch(error => console.error('Ошибка при загрузке проектов:', error));

// Функция получения уникальных тегов из проектов
function getUniqueTagsFromProjects(projects) {
    const tagSet = new Set();
    projects.forEach(project => {
        if (Array.isArray(project.tags)) {
            project.tags.forEach(tag => tagSet.add(tag.trim()));
        }
    });
    return Array.from(tagSet);
}

// Функция отображения тегов
function displayTags() {
    const tagsContainer = document.querySelector('.tags-container');
    tagsContainer.innerHTML = ''; // Очищаем контейнер

    tags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-button';
        button.textContent = tag;

        // Если тег выбран, добавляем класс 'active'
        if (selectedTags.includes(tag)) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            toggleTagSelection(tag);
        });
        tagsContainer.appendChild(button);
    });

    // Добавляем кнопку "Сбросить"
    const resetButton = document.createElement('button');
    resetButton.className = 'tag-button reset-button';
    resetButton.textContent = 'Сбросить';
    resetButton.addEventListener('click', () => {
        selectedTags = [];
        filterProjects();
    });
    tagsContainer.appendChild(resetButton);
}

// Функция переключения выбора тега
function toggleTagSelection(tag) {
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
    } else {
        selectedTags.push(tag);
    }
    filterProjects();
}

// Функция фильтрации проектов по выбранным тегам
function filterProjects() {
    if (selectedTags.length === 0) {
        filteredProjects = [...projects];
    } else {
        filteredProjects = projects.filter(project => {
            if (!Array.isArray(project.tags)) return false;
            return selectedTags.every(tag => project.tags.includes(tag));
        });
    }

    displayProjects();
    currentIndex = Math.floor(filteredProjects.length / 2);
    updateCarousel();
    updateActiveTagButtons();
}

// Функция обновления активного состояния кнопок тегов
function updateActiveTagButtons() {
    const tagButtons = document.querySelectorAll('.tag-button');
    tagButtons.forEach(button => {
        const tag = button.textContent;
        if (selectedTags.includes(tag)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }

        // Обрабатываем кнопку "Сбросить"
        if (button.classList.contains('reset-button') && selectedTags.length === 0) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
    });
}

// Функция отображения проектов
function displayProjects() {
    carouselInner.innerHTML = ''; // Очищаем карусель

    if (filteredProjects.length === 0) {
        // Если проектов нет, отображаем сообщение
        const message = document.createElement('div');
        message.className = 'no-projects-message';
        message.textContent = 'Нет проектов для отображения.';
        carouselInner.appendChild(message);
        return;
    }

    filteredProjects.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = 'project-card';

        // Устанавливаем фоновое изображение карточки
        card.style.backgroundImage = `url(${project.image})`;

        const info = document.createElement('div');
        info.className = 'project-info';

        const name = document.createElement('div');
        name.className = 'project-name';
        name.textContent = project.name;
        name.addEventListener('click', () => {
            window.open(project.link, '_blank');
        });
        info.appendChild(name);

        const description = document.createElement('div');
        description.className = 'project-description';
        description.textContent = project.description;
        info.appendChild(description);

        card.appendChild(info);
        carouselInner.appendChild(card);
    });
}

// Функция для добавления обработчиков событий
function addEventListeners() {
    // Обработчики событий для прокрутки колесиком мыши
    const carousel = document.querySelector('.carousel');
    carousel.addEventListener('wheel', handleWheel, { passive: false });

    // Обработчики для касаний
    carousel.addEventListener('touchstart', touchStart, { passive: false });
    carousel.addEventListener('touchend', touchEnd);
    carousel.addEventListener('touchmove', touchMove, { passive: false });

    // Обработчики для мыши (dragging)
    carousel.addEventListener('mousedown', mouseDown);
    carousel.addEventListener('mouseup', mouseUp);
    carousel.addEventListener('mouseleave', mouseLeave);
    carousel.addEventListener('mousemove', mouseMove);
}

// Функция для обновления карусели
function updateCarousel() {
    if (filteredProjects.length === 0) {
        carouselInner.style.transform = `translateX(0px)`;
        return;
    }

    const card = document.querySelector('.project-card');
    if (!card) return; // Если нет карточек, выходим

    const cardWidth = card.offsetWidth + 20; // ширина карточки + отступы
    const offset = -currentIndex * cardWidth + (window.innerWidth / 2 - cardWidth / 2);
    carouselInner.style.transform = `translateX(${offset}px)`;

    // Обновляем прозрачность карточек в зависимости от их расстояния от текущего индекса
    const cards = document.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
        const distance = Math.abs(index - currentIndex);
        const maxDistance = 2; // Максимальное количество карточек по обе стороны от текущей, которые будут видимы
        if (distance > maxDistance) {
            card.style.opacity = 0;
            card.style.transform = 'scale(0.6)';
        } else if (distance === 0) {
            card.style.opacity = 1;
            card.style.transform = 'scale(1)';
        } else if (distance === 1) {
            card.style.opacity = 0.7;
            card.style.transform = 'scale(0.85)';
        } else {
            card.style.opacity = 0.4;
            card.style.transform = 'scale(0.7)';
        }
    });
}

// Функция для обработки прокрутки колесиком мыши
function handleWheel(e) {
    e.preventDefault();

    if (isThrottled) return;

    const delta = e.deltaY;

    // Игнорировать малые прокрутки
    if (Math.abs(delta) < 10) return;

    if (delta > 0) {
        currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
    } else {
        currentIndex = Math.max(currentIndex - 1, 0);
    }

    updateCarousel();

    // Устанавливаем флаг блокировки и сбрасываем его через wheelThrottleTimeout
    isThrottled = true;
    setTimeout(() => {
        isThrottled = false;
    }, wheelThrottleTimeout);
}

// Функции для обработки касаний
function touchStart(e) {
    isDragging = true;
    startX = getPositionX(e);
    currentX = startX;
    velocity = 0;

    // Останавливаем текущую анимацию, если она есть
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function touchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const newX = getPositionX(e);
    const delta = newX - currentX;
    velocity = delta; // Сохраняем последнюю скорость
    currentX = newX;
}

function touchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;
    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            // Свайп вправо (предыдущий проект)
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            // Свайп влево (следующий проект)
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }

    // Запускаем инерционную анимацию, если есть скорость
    if (Math.abs(velocity) > velocityThreshold) {
        animateInertia();
    }
}

// Функции для обработки мыши (dragging)
function mouseDown(e) {
    isDragging = true;
    startX = getPositionX(e);
    currentX = startX;
    velocity = 0;

    // Останавливаем текущую анимацию, если она есть
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function mouseMove(e) {
    if (!isDragging) return;
    const newX = getPositionX(e);
    const delta = newX - currentX;
    velocity = delta; // Сохраняем последнюю скорость
    currentX = newX;
}

function mouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;
    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            // Свайп вправо (предыдущий проект)
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            // Свайп влево (следующий проект)
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }

    // Запускаем инерционную анимацию, если есть скорость
    if (Math.abs(velocity) > velocityThreshold) {
        animateInertia();
    }
}

function mouseLeave(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;
    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            // Свайп вправо (предыдущий проект)
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            // Свайп влево (следующий проект)
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }

    // Запускаем инерционную анимацию, если есть скорость
    if (Math.abs(velocity) > velocityThreshold) {
        animateInertia();
    }
}

// Вспомогательная функция для получения позиции X
function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
}

// Функция для инерционной анимации
function animateInertia() {
    velocity *= friction;

    if (Math.abs(velocity) < minVelocity) {
        // Скорость слишком мала, прекращаем анимацию
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }

    // Обновляем текущий индекс на основе скорости
    if (velocity > velocityThreshold) {
        currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
    } else if (velocity < -velocityThreshold) {
        currentIndex = Math.max(currentIndex - 1, 0);
    }

    updateCarousel();

    // Продолжаем анимацию
    animationFrameId = requestAnimationFrame(animateInertia);
}

