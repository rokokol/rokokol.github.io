// -----------------------------------------
// Логика карусели и тегов
// -----------------------------------------

const carouselInner = document.querySelector('.carousel-inner');
let currentIndex = 0;
let isDragging = false;
let isClick = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let projects = [];
let filteredProjects = [];
let tags = [];
let selectedTags = [];
let velocity = 0;
let animationFrameId = null;

const swipeThreshold = 30;
const velocityThreshold = 5;
const friction = 0.50;
const minVelocity = 0.3;
const wheelThrottleTimeout = 100;

let isThrottled = false;

// Загрузка данных о проектах
fetch('projects.json')
    .then(response => response.json())
    .then(data => {
        projects = data;
        filteredProjects = [...projects];
        tags = getUniqueTagsFromProjects(projects);
        displayTags();
        displayProjects();
        currentIndex = Math.floor(filteredProjects.length / 2);
        updateCarousel();
        addEventListeners();
    })
    .catch(error => console.error('Ошибка при загрузке проектов:', error));

function getUniqueTagsFromProjects(projects) {
    const tagSet = new Set();
    projects.forEach(project => {
        if (Array.isArray(project.tags)) {
            project.tags.forEach(tag => tagSet.add(tag.trim()));
        }
    });
    return Array.from(tagSet);
}

function displayTags() {
    const tagsContainer = document.querySelector('.tags-container');
    const existingButtons = tagsContainer.querySelectorAll('.tag-button, .reset-button');
    existingButtons.forEach(btn => btn.remove());

    tags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-button';
        button.textContent = tag;
        
        // Если это тег "Best", делаем фон золотым
        if (tag.toLowerCase() === 'best') {
            button.classList.add('best-tag');
        }

        if (selectedTags.includes(tag)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            toggleTagSelection(tag);
        });
        tagsContainer.appendChild(button);
    });

    const resetButton = document.createElement('button');
    resetButton.className = 'tag-button reset-button';
    resetButton.textContent = 'Сбросить';
    resetButton.addEventListener('click', () => {
        selectedTags = [];
        filterProjects();
    });
    tagsContainer.appendChild(resetButton);

    updateActiveTagButtons();
}

function toggleTagSelection(tag) {
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
    } else {
        selectedTags.push(tag);
    }
    filterProjects();
}

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

function updateActiveTagButtons() {
    const tagButtons = document.querySelectorAll('.tag-button');
    tagButtons.forEach(button => {
        const tag = button.textContent;
        if (selectedTags.includes(tag)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }

        if (button.classList.contains('reset-button') && selectedTags.length === 0) {
            button.classList.add('disabled');
        } else if (button.classList.contains('reset-button')) {
            button.classList.remove('disabled');
        }
    });
}

function displayProjects() {
    carouselInner.innerHTML = '';

    if (filteredProjects.length === 0) {
        const message = document.createElement('div');
        message.className = 'no-projects-message';
        message.textContent = '\n\n¯\\_(ツ)_/¯';
        carouselInner.appendChild(message);
        return;
    }

    filteredProjects.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = 'project-card';
        // Постер-картинка лежит фоном — она же первый кадр, пока грузится видео,
        // и источник акцентного цвета
        card.style.backgroundImage = `url(${project.image})`;
        applyAccentColor(card, project.image);

        // Если у проекта есть видео — кладём зацикленный <video> поверх фона
        if (Array.isArray(project.video) && project.video.length) {
            const video = document.createElement('video');
            video.className = 'project-video';
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.poster = project.image;
            project.video.forEach(src => {
                const source = document.createElement('source');
                source.src = src;
                source.type = src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
                video.appendChild(source);
            });
            card.appendChild(video);
        }

        const info = document.createElement('div');
        info.className = 'project-info';

        const name = document.createElement('div');
        name.className = 'project-name';
        name.textContent = project.name;

        // Если имя проекта "Best" - делаем золотым
        if (project.name.toLowerCase() === 'best') {
            name.classList.add('best');
        }

        name.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(project.link, '_blank');
        });
        info.appendChild(name);

        const description = document.createElement('div');
        description.className = 'project-description';
        description.textContent = project.description;
        info.appendChild(description);

        card.appendChild(info);
        carouselInner.appendChild(card);

        card.addEventListener('click', () => {
            if (currentIndex !== index) {
                currentIndex = index;
                updateCarousel();
            }
        });
    });
}

// Достаём из картинки проекта самый «живой» цвет и кладём его в CSS-переменную
// --accent-rgb, чтобы подсветка карточки совпадала с её изображением
function applyAccentColor(card, imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const size = canvas.width = canvas.height = 16;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, size, size);
            const { data } = ctx.getImageData(0, 0, size, size);

            let best = null;
            let bestScore = -1;
            let sumR = 0, sumG = 0, sumB = 0, count = 0;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 125) continue;
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum < 25 || lum > 235) continue; // пропускаем почти чёрное/белое

                sumR += r; sumG += g; sumB += b; count++;

                const saturation = Math.max(r, g, b) - Math.min(r, g, b);
                if (saturation > bestScore) {
                    bestScore = saturation;
                    best = [r, g, b];
                }
            }

            let color;
            if (best && bestScore > 20) color = best;          // выраженный цвет на картинке
            else if (count) color = [sumR / count, sumG / count, sumB / count]; // иначе среднее
            else return;                                        // совсем тёмная/пустая — оставляем дефолт

            color = makeVibrant(color);
            card.style.setProperty('--accent-rgb', color.map(Math.round).join(', '));
        } catch (e) {
            // тейнтнутый/непрочитанный canvas — просто оставляем дефолтный акцент
        }
    };
    img.src = imageUrl;
}

// Поднимаем яркость, чтобы цвет читался как акцент на тёмном фоне
function makeVibrant([r, g, b]) {
    const max = Math.max(r, g, b);
    if (max < 140) {
        const factor = 140 / Math.max(max, 1);
        r *= factor; g *= factor; b *= factor;
    }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

function addEventListeners() {
    const carousel = document.querySelector('.carousel');

    carousel.addEventListener('wheel', handleWheel);

    carousel.addEventListener('touchstart', touchStart);
    carousel.addEventListener('touchend', touchEnd);
    carousel.addEventListener('touchmove', touchMove);

    carousel.addEventListener('mousedown', mouseDown);
    carousel.addEventListener('mouseup', mouseUp);
    carousel.addEventListener('mouseleave', mouseLeave);
    carousel.addEventListener('mousemove', mouseMove);

    window.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
    // Не листаем, пока открыто окно с документами
    if (popup.style.display === 'flex') return;
    if (filteredProjects.length === 0) return;

    if (e.key === 'ArrowLeft') {
        currentIndex = Math.max(currentIndex - 1, 0);
        updateCarousel();
    } else if (e.key === 'ArrowRight') {
        currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        updateCarousel();
    }
}

function updateCarousel() {
    if (filteredProjects.length === 0) {
        carouselInner.style.transform = `translateX(0px)`;
        return;
    }

    const card = document.querySelector('.project-card');
    if (!card) return;

    const cardWidth = card.offsetWidth + 20;
    const offset = -currentIndex * cardWidth + (window.innerWidth / 2 - cardWidth / 2);
    carouselInner.style.transform = `translateX(${offset}px)`;

    const cards = document.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
        const distance = Math.abs(index - currentIndex);
        const maxDistance = 2;
        card.classList.toggle('centered', distance === 0);
        if (distance > maxDistance) {
            card.style.opacity = 0;
            card.style.transform = 'scale(0.6)';
            card.style.pointerEvents = 'none';
        } else if (distance === 0) {
            card.style.opacity = 1;
            card.style.transform = 'scale(1)';
            card.style.pointerEvents = 'auto';
        } else if (distance === 1) {
            card.style.opacity = 0.7;
            card.style.transform = 'scale(0.85)';
            card.style.pointerEvents = 'auto';
        } else {
            card.style.opacity = 0.4;
            card.style.transform = 'scale(0.7)';
            card.style.pointerEvents = 'auto';
        }
    });
}

function handleWheel(e) {
    let delta;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        delta = e.deltaX;
    } else {
        delta = e.deltaY;
    }

    if (Math.abs(delta) < 10) return;
    if (isThrottled) return;

    if (delta > 0) {
        if (currentIndex < filteredProjects.length - 1) {
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
            e.preventDefault();
            updateCarousel();
            isThrottled = true;
            setTimeout(() => { isThrottled = false; }, wheelThrottleTimeout);
        }
    } else {
        if (currentIndex > 0) {
            currentIndex = Math.max(currentIndex - 1, 0);
            e.preventDefault();
            updateCarousel();
            isThrottled = true;
            setTimeout(() => { isThrottled = false; }, wheelThrottleTimeout);
        }
    }
}

// Касания
function touchStart(e) {
    if (e.touches.length > 1) return;
    isDragging = true;
    isClick = true;
    startX = getPositionX(e);
    startY = e.touches[0].clientY;
    currentX = startX;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function touchMove(e) {
    if (!isDragging || e.touches.length > 1) return;
    const newX = getPositionX(e);
    const newY = e.touches[0].clientY;
    const deltaX = newX - startX;
    const deltaY = newY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
        isClick = false;
        velocity = deltaX;
        currentX = newX;
    }
}

function touchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;

    if (isClick) return;

    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }
}

// Мышь
function mouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    isClick = true;
    startX = getPositionX(e);
    startY = e.clientY;
    currentX = startX;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function mouseMove(e) {
    if (!isDragging) return;
    const newX = getPositionX(e);
    const newY = e.clientY;
    const deltaX = newX - startX;
    const deltaY = newY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
        isClick = false;
        velocity = deltaX;
        currentX = newX;
    }
}

function mouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;

    if (isClick) return;

    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }
}

function mouseLeave(e) {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;

    if (isClick) return;

    if (Math.abs(diff) > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
        if (diff > 0 || velocity > velocityThreshold) {
            currentIndex = Math.max(currentIndex - 1, 0);
        } else {
            currentIndex = Math.min(currentIndex + 1, filteredProjects.length - 1);
        }
        updateCarousel();
    }
}

function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
}


// -----------------------------------------
// Логика всплывающего окна с документами
// -----------------------------------------

const docButton = document.getElementById('docButton');
const popup = document.getElementById('popup');
const tabsContainer = document.getElementById('tabs');
const tabContent = document.getElementById('tabContent');
const popupClose = document.getElementById('popupClose');

docButton.addEventListener('click', () => {
    popup.style.display = 'flex';
    loadPapers();
});

popupClose.addEventListener('click', () => {
    closePopup();
});

window.addEventListener('click', (e) => {
    if (e.target === popup) {
        closePopup();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePopup();
    }
});

function closePopup() {
    popup.style.display = 'none';
    tabsContainer.innerHTML = '';
    tabContent.innerHTML = '';
}

// Загрузка и отображение документов из папки papers
function loadPapers() {
    tabsContainer.innerHTML = '';
    tabContent.innerHTML = '';

    // Получаем список файлов
    fetch('papers/files.json')
        .then(res => res.json())
        .then(allFiles => {
            // Фильтруем только .md файлы
            const mdFiles = allFiles.filter(fileName => fileName.toLowerCase().endsWith('.md'));
            const promises = mdFiles.map(fileName => {
                const url = `papers/${fileName}`;
                return fetch(url).then(res => res.text()).then(text => ({fileName, text}));
            });

            Promise.all(promises).then(fileDataArray => {
                const papersData = fileDataArray.map(fd => {
                    const lines = fd.text.split('\n');
                    const titleLine = lines[0].replace(/^#\s*/, '').trim();
                    return { title: titleLine, content: fd.text };
                });

                papersData.forEach((paper, index) => {
                    const tabButton = document.createElement('button');
                    tabButton.className = 'tab-button';
                    tabButton.textContent = paper.title;

                    tabButton.addEventListener('click', () => {
                        selectTab(index, papersData);
                    });

                    tabsContainer.appendChild(tabButton);
                });

                // Показать первую вкладку по умолчанию
                if (papersData.length > 0) {
                    selectTab(0, papersData);
                }
            }).catch(error => console.error('Ошибка при загрузке документов:', error));
        })
        .catch(error => console.error('Ошибка при загрузке списка файлов:', error));
}

function selectTab(index, papersData) {
    const buttons = tabsContainer.querySelectorAll('.tab-button');
    buttons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    const content = papersData[index].content;
    tabContent.innerHTML = renderMarkdown(content);
}

function renderMarkdown(md) {
    let html = md
        // Блочные кодовые блоки (```...```)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

        // Инлайн код (`...`)
        .replace(/`([^`]+)`/g, '<code>$1</code>')

        // Заголовки (от частного к общему, чтобы ## и ### не съедались правилом #)
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')

        // Горизонтальная линия (--- на отдельной строке)
        .replace(/^---$/gim, '<hr>')

        // Жирный текст
        .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')

        // Курсив
        .replace(/__(.*?)__/gim, '<i>$1</i>')

        // Ссылки [текст](ссылка)
        .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')

        // Переносы строк
        .replace(/\n/gim, '<br>');

    // Убираем лишние переносы вокруг блочных элементов — иначе пустые
    // строки markdown превращаются в зияющие пробелы между заголовками
    html = html
        .replace(/(<br>\s*){2,}/g, '<br><br>')                       // максимум одна пустая строка
        .replace(/(<br>\s*)+(<(?:h1|h2|h3|hr|pre))/g, '$2')          // нет переносов перед блоком
        .replace(/(<\/(?:h1|h2|h3|pre)>|<hr>)(\s*<br>)+/g, '$1');    // и сразу после блока

    return html.trim();
}

