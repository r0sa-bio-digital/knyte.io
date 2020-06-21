Базовые понятия инженерии знаний
================================

Текстовые и интерактивные определения базовых понятий инженерии знаний
с точки зрения практической программной разработки
и био-цифровых технологий.

Хостинг проекта
---------------
* Официальная страница: <https://www.knyte.io>
* Статика и IDE: <https://knyte-io.glitch.me>
* Репозиторий с исходниками: <https://github.com/r0sa-bio-digital/knyte.io/>

Прототип пространства
---------------------
* Ссылки на модули
  * Интерактивный прототип: <https://www.knyte.io/space>
  * Спецификация Knoxel Space: <https://github.com/r0sa-bio-digital/knyte.io/blob/master/space/knoxelSpace.json>
    * документ в собственном формате Knoxel Space
    * для использования его нужно сохранить локально в json-файл
      * и затем загрузить в систему как стейт
* Управление
  * drop file on app screen - загрузить стейт системы из json-файла
  * console global variables
    * runBlockDelay - задержка (в миллисекундах) при запуске кода каждого выплняемого run block'а
      * служит для отладочных целей - чтобы наблюдать за динамикой потока выполнения инструкций
      * по умолчанию равно 0
  * vertical/horizontal scroll - перемещение в пространстве root knoxel'я
  * shift + vertical scroll - изменение масштаба пространства root knoxel'я
  * shortcuts
    * cmd + s - сохранить стейт системы в json-файл
    * cmd + click - создать новый knyte и knoxel для него в указанной точке пространства
    * cmd + alt + click - создать новый run block knyte и knoxel для него в указанной точке пространства
    * click в knoxel - перейти в пространство knoxel'я
    * space
      * без ghost'а - создать ghost для выбранного knoxel'я
        * пространство - это тоже knoxel. ghost существует в screenspace'e и привязан к курсору.
      * c ghost'ом - переместить ghost knoxel в выбранную позицию выбранного пространства
    * z
      * без ghost'а - начать создание/изменение initial-части vector'а между knyte'ами
      * c ghost'ом на другом knoxel'е - назначить knyte этого knoxel'я как initial для ghosted knyte'а
      * c ghost'ом на пустом месте - сбросить initial для ghosted knyte'а
    * x
      * без ghost'а - начать создание/изменение terminal-части vector'а между knyte'ами
      * c ghost'ом на другом knoxel'е - назначить knyte этого knoxel'я как terminal для ghosted knyte'а
      * c ghost'ом на пустом месте - сбросить terminal для ghosted knyte'а
    * b
      * без bubble'а - создать bubble для выбранного knoxel'я
        * пространство - это тоже knoxel. bubble существует в screenspace'e и привязан к курсору.
      * с bubble'ом на knoxel'е того же knyte'а - объединить 2 knoxel'я в 1
      * с bubble'ом в другом месте - создать ещё 1 knoxel для выбранного knyte'а
    * n
      * без bubble'а - начать создание/изменение initial-части vector'а между knoxel'ями
      * с bubble'ом на knoxel'е того же knyte'а - назначить knoxel как initial для bubbled knoxel'я
      * с bubble'ом в другом месте - сбросить initial для ghosted knoxel'я
    * m
      * без bubble'а - начать создание/изменение terminal-части vector'а между knoxel'ями
      * с bubble'ом на knoxel'е того же knyte'а - назначить knoxel как terminal для bubbled knoxel'я
      * с bubble'ом в другом месте - сбросить terminal для ghosted knoxel'я
    * enter
      * в режиме пространства - вызвать default information record editor для knoxel'я под курсором
      * в режиме редактора - установить внесённые изменения
    * alt + enter
      * в режиме пространства - вызвать unified information record editor для knoxel'я под курсором
      * в режиме редактора - установить внесённые изменения
    * c
      * в режиме пространства - вызвать редактор color'а для knyte.record knoxel'я под курсором
    * v
      * в режиме пространства - вызвать редактор color'а для knoxel'я под курсором
    * s
      * в режиме пространства - вызвать редактор size'а для knyte.record knoxel'я под курсором
    * d
      * в режиме пространства - задать collapse/expand для knoxel'я под курсором
    * escape
      * c ghost'ом - сбросить ghost
      * c bubble'ом - сбросить bubble
      * в режиме редактора - закрыть редактор без применения изменений
    * o
      * показать knoxel id для knOxel'я под курсором
    * y
      * показать knyte id для knYte'а, соответствующего knoxel'ю под курсором
  * buttons
    * space map - переход в пространство всех knoxel'ей, сгруппированных по связным островам
    * space back - возврат в предыдущее пространство
    * space forward - повторный вход в следующее пространство
    * space host - переход в пространство, где расположен ghosted knoxel
    
Размерности разработки
----------------------
* bio-digital concept
* knoxel space
* attached knyte cloud
* attached information map
* command history
* full circle functionality
  * documentation, modelling, programming, data base, frontend
* self-definition
  * clone knowledge base using only knowledge base tools
* collaborative work and cloud run-time
* unified bio-digital language
* full cycle ecosystem