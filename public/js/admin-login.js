(function () {
  const form = document.querySelector('#admin-login-form');
  const message = document.querySelector('#admin-login-message');
  const submit = form && form.querySelector('button[type="submit"]');
  if (!form || !message || !submit) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    message.textContent = '';
    if (!username || !password) {
      message.textContent = 'Введите логин и пароль';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Входим…';
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Не удалось войти');
      window.location.assign('/admin');
    } catch (error) {
      message.textContent = error.message || 'Не удалось войти';
      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  });
}());
