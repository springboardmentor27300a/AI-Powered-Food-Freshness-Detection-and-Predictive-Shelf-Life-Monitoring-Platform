from app.models.inventory import FoodItem
def seed(db):
    existing={x.name.lower() for x in db.query(FoodItem).all()}
    defaults=[("Apple","Fruits","kg",1,6,45,80),("Banana","Fruits","kg",12,15,50,80),("Orange","Fruits","kg",4,8,45,80),("Grapes","Fruits","kg",1,4,60,85),("Tomato","Vegetables","kg",8,12,60,85),("Potato","Vegetables","kg",7,12,55,75),("Carrot","Vegetables","kg",2,8,55,80),("Spinach","Vegetables","kg",2,5,70,95),("Milk","Dairy Products","litre",2,6,40,70),("Yogurt","Dairy Products","kg",2,6,40,70),("Cheese","Dairy Products","kg",2,8,40,70),("Chicken","Meat & Poultry","kg",0,4,40,70),("Beef","Meat & Poultry","kg",0,4,40,70),("Fish","Seafood","kg",0,3,60,85),("Bread","Bakery Products","pack",18,25,40,65),("Cake","Bakery Products","piece",2,8,45,70),("Biscuits","Packaged Foods","pack",15,30,30,65),("Fruit Juice","Beverages","litre",2,8,35,65)]
    for n,c,u,mn,mx,hmn,hmx in defaults:
        if n.lower() not in existing: db.add(FoodItem(name=n,category=c,unit=u,min_temp=mn,max_temp=mx,min_humidity=hmn,max_humidity=hmx))
    db.commit()
