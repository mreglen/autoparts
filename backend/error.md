Получение информации о заказах
Получение информации о заказах по статусу. Максимальное количество запросов в минуту - 500.

Authorizations:
ClientCredentials
query Parameters
ids	
Array of strings
Идентификаторы заказов

statuses	
Array of strings (status)
Items Enum: "on_confirmation" "ready_to_ship" "in_transit" "canceled" "delivered" "on_return" "in_dispute" "closed"
Статус, по которому нужно получить заказы.

on_confirmation - ожидает подтверждения

ready_to_ship - ждет отправки

in_transit - в пути

canceled - отменный заказ

delivered - доставлен покупателю

on_return - на возврате

in_dispute - по заказу открыт спор

closed - заказ закрыт

dateFrom	
integer
Example: dateFrom=1686735089
Метка времени, с момента которого созданы покупки

page	
integer
Example: page=1
Номер страницы для пагинации

limit	
integer [ 0 .. 20 ]
Example: limit=10
Максимальное количество заказов на странице

header Parameters
Authorization
required
string
Example: Bearer ACCESS_TOKEN
Токен для авторизации

https://api.avito.ru/order-management/1/orders