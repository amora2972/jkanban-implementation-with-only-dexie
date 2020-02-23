import Dexie from 'dexie';
import {ITicket} from './interfaces/ticket.interface';
import {IColumn} from './interfaces/column.interface';

class KanbanDatabase extends Dexie {

  public columns: Dexie.Table<IColumn, number>;
  public tickets: Dexie.Table<ITicket, number>;

  constructor() {

    super('kanban');
    const db = this;

    // create db
    db.version(1).stores({
      columns: '++id, title',
      tickets: '++id, title, columnId, order, image'
    });

    // this operation will run on every columns reading operation.
    db.columns.hook('reading', (obj: IColumn) => {
      obj.id = String(obj.id);
      return obj;
    });

    // this operation will run on every ticket adding operation.
    db.tickets.hook('creating', (primaryKey: number, obj: ITicket, transaction) => {
      obj.columnId = +obj.columnId;
      obj.title = obj.originalTitle;
      delete obj.originalTitle;
    });

    // this operation will run on every ticket reading operation.
    db.tickets.hook('reading', (obj: ITicket) => {
      obj.id = String(obj.id);
      obj.columnId = String(obj.columnId);
      obj.originalTitle = obj.title;
      obj.title = `<img src='${obj.image}' class="img-fluid"> ` + obj.title;
      return obj;
    });

    // this operation will run on every ticket updating operation.
    db.tickets.hook('updating', (modifications: ITicket, primKey: number, obj: ITicket, transaction) => {
      modifications.columnId = +modifications.columnId;
      modifications.title = modifications.originalTitle || obj.title;
      delete modifications.originalTitle;
      delete obj.originalTitle;
    });

    // only runs the first time when the db is initialized
    db.on('populate', () => {
      db.columns.add({title: 'No Status'});
      db.columns.add({title: 'First Call'});
      db.columns.add({title: 'Negotiation'});
      db.columns.add({title: 'Win-Closed'});
      db.columns.add({title: 'Lost-Closed'});
    });

    db.open();
  }
}

export const kanbanDb = new KanbanDatabase();
