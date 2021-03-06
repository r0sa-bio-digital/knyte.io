Базовые понятия инженерии знаний
================================

Текстовые и интерактивные определения базовых понятий инженерии знаний
с точки зрения практической программной разработки
и био-цифровых технологий.

Хостинг проекта
---------------
* Официальная страница: <https://knyte.io/>
* Хостинг статики
  * prod <https://knyte.netlify.app/>
  * dev <https://knyte-dev.netlify.app/>
* Репозиторий с исходниками: <https://github.com/r0sa-bio-digital/knyte.io/>

Прототип пространства
---------------------
* Ссылки на модули
  * Интерактивный прототип: <https://knyte.io/space/>
  * Подключение к github repo: <https://knyte.io/space/?owner=owner-name&repo=repo-name&pat=access-token>
    * pat должен быть опциональным - не требуется для read only доступа к публичным репам
    * тест подключения к репу: <https://knyte.io/test/?owner=owner-name&repo=repo-name&pat=access-token>
  * Спецификация на ядро системы: <https://github.com/r0sa-bio-digital/knyte-spec>
    * документ в собственном формате Knoxel Space
    * для использования нужно открывать ссылку <https://knyte.io/space/?owner=r0sa-bio-digital&repo=knyte-spec>
      * сгенерировать и использовать personal access token (PAT) для авторизации доступа к репу
      * как создавать PAT на githab'е: <https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token>
  * Промежуточная версия в процессе разработке: <https://knyte-dev.netlify.app/space/>
* Управление
  * drop file on app screen - загрузить стейт системы из json-файла
  * console global variables
    * runBlockDelay - задержка (в миллисекундах) при запуске кода каждого выплняемого run block'а
      * служит для отладочных целей - чтобы наблюдать за динамикой потока выполнения инструкций
      * по умолчанию равно 0
  * vertical/horizontal scroll - перемещение в пространстве root knoxel'я
  * shift + vertical scroll - изменение масштаба пространства root knoxel'я
  * shortcuts
    * cmd + s - сохранить стейт системы в json-файл быстрым методом
      * без сортировки ключей, не подходит для построения адекватных diff'ов в git'е
    * cmd + shift + s - сохранить стейт системы в json-файл медленным методом
      * с сортировкой ключей, оптимально для построения diff'ов в git'е
    * cmd + g - загрузить стейт системы в подсоединённый github repo при наличии прав на запись в PAT
    * cmd + click - создать новый knyte и knoxel для него в указанной точке пространства
    * cmd + alt + click - создать новый run block knyte и knoxel для него в указанной точке пространства
    * cmd + shift + click - создать knyte с заданным knyte id и knoxel для него в указанной точке пространства
      * knyte id должен быть уникальным в рамках текущего knyte cloud'а и иметь формат uuid v4
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
    * f
      * без frame'а - начать выделение knoxel'ей frame'ом для группировки
      * c frame'ом - сгруппировать полностью захваченные frame'ом knoxel'и в отдельное пространство
    * e
      * в режиме пространства - произвести extract для knoxel'я под курсором
        * вынуть из пространства knoxel'я все вложенные в него knoxel'и и поместить их в space root
    * escape
      * c ghost'ом - сбросить ghost
      * c bubble'ом - сбросить bubble
      * c frame'ом - сбросить frame
      * в режиме редактора - закрыть редактор без применения изменений
    * r
      * сбросить навигацию в пространстве - установить пан (0, 0) и зум (1), полезно если потерялся
    * o
      * показать knoxel id для knOxel'я под курсором
    * y
      * показать knyte id для knYte'а, соответствующего knoxel'ю под курсором
    * j
      * прыгнуть к knoxel'ю по заданному knoxel id
    * k
      * создать knoxelmap для knyte'а, соответствующего knoxel'ю под курсором
        * он содержит кнопки для прыжков ко всем knoxel'ям данного knyte'а
    * shift + k
      * создать knoxelmap для knyte'а по заданному knyte id
    * l
      * создать knytemap для knyte'а, соответствующего knoxel'ю под курсором
        * он содержит граф связей данного knyte'а со всеми остальными knyte'ами
    * shift + l
      * создать knytemap для knyte'а по заданному knyte id
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