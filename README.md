Базовые понятия инженерии знаний
================================

Текстовые и интерактивные определения базовых понятий инженерии знаний
с точки зрения практической программной разработки
и био-цифровых технологий.

Хостинг
-------
* Исходники: <https://github.com/r0sa-bio-digital/knyte.io/>
* Статика и IDE: <https://knyte-io.glitch.me>
* Официальная страница: <https://www.knyte.io>

Размерности разработки
----------------------
* bio-digital concept
* knoxel space
* attached knyte web
* attached information map
* command history
* full circle functionality
  * documentation, modelling, programming, data base, frontend
* self-definition
  * clone knowledge base using only knowledge base tools
* collaborative work and cloud run-time
* unified bio-digital language
* full cycle ecosystem

Прототип пространства
---------------------
* ссылка
  * <https://knyte-io.glitch.me/space>
  * <https://www.knyte.io/space>
* управление
  * shortcuts
    * cmd + click - создать новый knyte и knoxel для него в указанной точке пространства
    * click в knoxel - перейти в пространство knoxel'я
    * space
      * без ghost'а - создать ghost для выбранного knoxel'я
        * пространство - это тоже knoxel. ghost существует в screenspace'e и привязан к курсору.
      * c ghost'ом - переместить ghost knoxel в выбранную позицию выбранного пространства
    * b
      * без bubble'а - создать bubble для выбранного knoxel'я
        * пространство - это тоже knoxel. bubble существует в screenspace'e и привязан к курсору.
      * с bubble'ом на knoxel'е того же knyte'а - объединить 2 knoxel'я в 1
      * с bubble'ом в другом месте - создать ещё 1 knoxel для выбранного knyte'а
    * enter
      * в режиме пространства - вызвать редактор information record'а для knoxel'я под курсором
      * в режиме редактора - установить внесённые изменения
    * c
      * в режиме пространства - вызвать редактор color'а для knoxel'я под курсором
      * в режиме редактора - установить внесённые изменения
    * s
      * в режиме пространства - вызвать редактор ышяу'а для knoxel'я под курсором
      * в режиме редактора - установить внесённые изменения
    * escape
      * c ghost'ом - сбросить ghost
      * c bubble'ом - сбросить bubble
      * в режиме редактора - закрыть редактор без применения изменений
  * buttons
    * space map - переход в пространство всех knoxel'ей, сгруппированных по связным островам
    * space back - возврат в предыдущее пространство
    * space forward - повторный вход в следующее пространство
    * space host - переход в пространство, где расположен ghosted knoxel