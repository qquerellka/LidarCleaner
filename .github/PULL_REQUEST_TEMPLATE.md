# Pull Request

## 📝 Описание

Краткое описание изменений в этом PR.

Fixes #(issue_number) <!-- Если PR решает issue -->

## 🎯 Тип изменения

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style update (formatting, renaming)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Configuration change
- [ ] 🗑️ Deprecation

## 🧪 Как было протестировано?

Опишите тесты, которые вы провели для проверки изменений.

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] E2E tests

**Test Configuration**:
- OS: [e.g., Linux Ubuntu 22.04]
- Node.js: [e.g., 18.17.0]
- Browser: [e.g., Electron 30.0]

**Test scenario:**
1. Step 1
2. Step 2
3. ...

## 📸 Скриншоты (если применимо)

Добавьте скриншоты для UI изменений.

| Before | After |
|--------|-------|
| ![before](url) | ![after](url) |

## ✔️ Checklist

### Code Quality

- [ ] Мой код следует style guidelines проекта
- [ ] Я провел self-review своего кода
- [ ] Я прокомментировал сложные участки кода
- [ ] Нет предупреждений линтера (`npm run lint`)
- [ ] Нет ошибок TypeScript (`npm run type-check`)

### Testing

- [ ] Я добавил/обновил тесты для своих изменений
- [ ] Все новые и существующие тесты проходят (`npm run test`)
- [ ] Я протестировал edge cases
- [ ] Я проверил производительность (если применимо)

### Documentation

- [ ] Я обновил документацию (README, API docs, etc.)
- [ ] Я добавил комментарии в код
- [ ] Я обновил CHANGELOG.md
- [ ] Я обновил типы (если применимо)

### Git

- [ ] Мои коммиты следуют [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Я провел rebase с main/master
- [ ] Нет конфликтов с целевой веткой
- [ ] История коммитов чистая (нет "WIP", "fix", etc.)

## 🔗 Связанные Issues/PRs

- Closes #123
- Related to #456
- Depends on #789

## 📊 Performance Impact (если применимо)

Опишите влияние на производительность (если есть):

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Load time | 2.5s | 1.8s | -28% |
| Memory | 500MB | 450MB | -10% |

## 🚨 Breaking Changes (если есть)

Опишите breaking changes и migration path:

**Before:**
```typescript
// old code
```

**After:**
```typescript
// new code
```

**Migration:**
1. Update X to Y
2. Change Z to W
3. ...

## 📎 Дополнительный контекст

Любая дополнительная информация о PR.

## 👀 Reviewers

@mention specific reviewers if needed

---

**Для мантейнеров:**
- [ ] Code review passed
- [ ] CI/CD checks passed
- [ ] Documentation approved
- [ ] Ready to merge

